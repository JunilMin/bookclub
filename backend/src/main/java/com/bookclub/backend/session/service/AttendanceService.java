package com.bookclub.backend.session.service;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.AttendanceRecord;
import com.bookclub.backend.session.model.AttendanceRecord.*;
import com.bookclub.backend.session.repository.AttendanceRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AttendanceService {

    @Autowired
    private AttendanceRecordRepository attendanceRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    // 출석 윈도우: T0부터 15분 이내 입장 시 ON_TIME
    private static final int ATTENDANCE_WINDOW_MINUTES = 15;

    // 출석 확정 기준
    private static final int REQUIRED_SPEECH_SEC = 120;          // 2분
    private static final int REQUIRED_NOTE_CHARS = 25;           // 25자
    private static final double HAND_RAISE_REDUCTION = 0.20;     // 20% 완화

    /**
     * 사용자 입장 시 출석 기록 생성 또는 재접속 처리
     */
    public AttendanceRecord handleJoin(String sessionId, String userId, String username, String photoUrl) {
        LocalDateTime now = LocalDateTime.now();

        // 기존 출석 기록 확인
        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);

        if (existing.isPresent()) {
            // 재접속: 현재 세션 시작 시각 갱신
            AttendanceRecord record = existing.get();
            record.getTime().setCurrentSessionStart(now);
            record.getTime().setLastSeenAt(now);
            record.setUpdatedAt(now);
            return attendanceRepository.save(record);
        }

        // 신규 입장: 새 출석 기록 생성
        Session session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            throw new IllegalArgumentException("Session not found: " + sessionId);
        }

        Post post = postRepository.findById(session.getPostId()).orElse(null);
        if (post == null) {
            throw new IllegalArgumentException("Post not found for session: " + sessionId);
        }

        AttendanceRecord record = new AttendanceRecord(
                post.getId(),
                sessionId,
                userId,
                username,
                photoUrl
        );

        // 시간 정보 설정
        TimeInfo time = record.getTime();
        time.setStartAt(post.getDue());  // 미팅 시작 시각 (post.due)
        time.setFirstJoinAt(now);
        time.setLastSeenAt(now);
        time.setCurrentSessionStart(now);
        time.setTotalPresenceSec(0);

        // 출석 유형 결정
        record.setAttendanceType(determineAttendanceType(now, post.getDue()));

        // 마일스톤: 입장 완료
        record.getMilestones().setJoined(true);
        record.getMilestones().setJoinedAt(now);

        return attendanceRepository.save(record);
    }

    /**
     * 사용자 퇴장 시 접속 시간 누적
     */
    public AttendanceRecord handleLeave(String sessionId, String userId) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;  // 출석 기록 없음
        }

        AttendanceRecord record = existing.get();
        TimeInfo time = record.getTime();

        // 현재 세션 시간 계산 및 누적
        if (time.getCurrentSessionStart() != null) {
            long sessionDuration = Duration.between(time.getCurrentSessionStart(), now).getSeconds();

            // 접속 세션 기록 추가
            PresenceSession presenceSession = new PresenceSession(
                    time.getCurrentSessionStart(),
                    now,
                    sessionDuration
            );
            time.getPresenceSessions().add(presenceSession);

            // 총 접속 시간 누적
            time.setTotalPresenceSec(time.getTotalPresenceSec() + sessionDuration);
            time.setCurrentSessionStart(null);  // 세션 종료
        }

        time.setLastSeenAt(now);
        record.setUpdatedAt(now);

        // EARLY 타입 검증: T0까지 연결 유지 여부 확인
        updateEarlyAttendanceStatus(record, now);

        return attendanceRepository.save(record);
    }

    /**
     * 발언 시작 시 호출
     */
    public AttendanceRecord handleSpeakStart(String sessionId, String userId) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;
        }

        AttendanceRecord record = existing.get();
        ActivityInfo activities = record.getActivities();

        activities.setCurrentSpeakStart(now);
        activities.setSpeakCount(activities.getSpeakCount() + 1);

        // 마일스톤: 첫 발언
        if (!record.getMilestones().isSpoke()) {
            record.getMilestones().setSpoke(true);
            record.getMilestones().setSpokeAt(now);
        }

        record.getTime().setLastSeenAt(now);
        record.setUpdatedAt(now);

        return attendanceRepository.save(record);
    }

    /**
     * 발언 종료 시 호출 (발언 시간 누적)
     */
    public AttendanceRecord handleSpeakEnd(String sessionId, String userId) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;
        }

        AttendanceRecord record = existing.get();
        ActivityInfo activities = record.getActivities();

        // 발언 시간 누적
        if (activities.getCurrentSpeakStart() != null) {
            long speakDuration = Duration.between(activities.getCurrentSpeakStart(), now).getSeconds();
            activities.setSpeechSec(activities.getSpeechSec() + speakDuration);
            activities.setCurrentSpeakStart(null);
        }

        record.getTime().setLastSeenAt(now);
        record.setUpdatedAt(now);

        // 출석 확정 조건 확인
        checkAndConfirmAttendance(record);

        return attendanceRepository.save(record);
    }

    /**
     * 노트 업데이트 시 호출
     * @param charCount 현재 노트의 총 글자수
     */
    public AttendanceRecord handleNoteUpdate(String sessionId, String userId, int charCount) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;
        }

        AttendanceRecord record = existing.get();
        ActivityInfo activities = record.getActivities();

        // 현재 글자수 업데이트
        activities.setNoteCharCountCurrent(charCount);

        // 누적 글자수: 최대값 유지 (삭제해도 감소하지 않음)
        if (charCount > activities.getNoteCharCount()) {
            activities.setNoteCharCount(charCount);
        }

        // 마일스톤: 첫 노트 작성 (5자 이상)
        if (!record.getMilestones().isNoted() && charCount >= 5) {
            record.getMilestones().setNoted(true);
            record.getMilestones().setNotedAt(now);
        }

        record.getTime().setLastSeenAt(now);
        record.setUpdatedAt(now);

        // 출석 확정 조건 확인
        checkAndConfirmAttendance(record);

        return attendanceRepository.save(record);
    }

    /**
     * 손들기 시 호출
     */
    public AttendanceRecord handleHandRaise(String sessionId, String userId) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;
        }

        AttendanceRecord record = existing.get();
        ActivityInfo activities = record.getActivities();

        activities.setHandRaisedAt(now);
        activities.setHandRaiseCount(activities.getHandRaiseCount() + 1);

        // 마일스톤: 손들기
        if (!record.getMilestones().isHandRaised()) {
            record.getMilestones().setHandRaised(true);
            record.getMilestones().setHandRaisedAt(now);
        }

        record.getTime().setLastSeenAt(now);
        record.setUpdatedAt(now);

        // 출석 확정 조건 재확인 (손들기로 기준이 낮아짐)
        checkAndConfirmAttendance(record);

        return attendanceRepository.save(record);
    }

    /**
     * 하트비트 업데이트 (활동 유지 확인)
     */
    public AttendanceRecord handleHeartbeat(String sessionId, String userId) {
        LocalDateTime now = LocalDateTime.now();

        Optional<AttendanceRecord> existing = attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existing.isEmpty()) {
            return null;
        }

        AttendanceRecord record = existing.get();
        record.getTime().setLastSeenAt(now);
        record.setUpdatedAt(now);

        return attendanceRepository.save(record);
    }

    // ============== 조회 메서드 ==============

    /**
     * 세션의 모든 출석 기록 조회
     */
    public List<AttendanceRecord> getSessionAttendance(String sessionId) {
        return attendanceRepository.findAllBySessionId(sessionId);
    }

    /**
     * 특정 사용자의 세션 출석 기록 조회
     */
    public Optional<AttendanceRecord> getUserAttendance(String sessionId, String userId) {
        return attendanceRepository.findBySessionIdAndUserId(sessionId, userId);
    }

    /**
     * 사용자의 모든 출석 기록 조회 (히스토리)
     */
    public List<AttendanceRecord> getUserAttendanceHistory(String userId) {
        return attendanceRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * 사용자의 확정된 출석만 조회
     */
    public List<AttendanceRecord> getUserConfirmedAttendance(String userId) {
        return attendanceRepository.findAllByUserIdAndStatus(userId, AttendanceStatus.CONFIRMED);
    }

    // ============== 내부 헬퍼 메서드 ==============

    /**
     * 출석 유형 결정 (입장 시각 기준)
     */
    private AttendanceType determineAttendanceType(LocalDateTime joinTime, LocalDateTime meetingStartTime) {
        if (meetingStartTime == null) {
            // 시작 시각이 없으면 기본적으로 ON_TIME
            return AttendanceType.ON_TIME;
        }

        LocalDateTime windowEnd = meetingStartTime.plusMinutes(ATTENDANCE_WINDOW_MINUTES);

        if (joinTime.isBefore(meetingStartTime)) {
            return AttendanceType.EARLY;  // T0 이전 입장 (T0까지 연결 유지 필요)
        } else if (!joinTime.isAfter(windowEnd)) {
            return AttendanceType.ON_TIME;  // T0 ~ T0+W
        } else {
            return AttendanceType.LATE;  // T0+W 이후
        }
    }

    /**
     * EARLY 출석 유형 검증: T0까지 연결 유지했는지 확인
     */
    private void updateEarlyAttendanceStatus(AttendanceRecord record, LocalDateTime leaveTime) {
        if (record.getAttendanceType() != AttendanceType.EARLY) {
            return;
        }

        TimeInfo time = record.getTime();
        LocalDateTime meetingStart = time.getStartAt();

        if (meetingStart == null) {
            return;
        }

        // 미팅 시작 전에 퇴장했다면 EARLY 유지 불가 → LATE로 변경
        // 단, 나중에 다시 접속해서 T0 시점에 접속 중이었다면 EARLY 유지
        if (leaveTime.isBefore(meetingStart)) {
            // 아직 미팅 시작 전이므로 판정 보류 (재접속 가능)
            return;
        }

        // 미팅 시작 후 퇴장: 출석 세션들을 확인
        // T0 시점에 접속 중이었는지 확인
        boolean wasOnlineAtStart = false;
        for (PresenceSession session : time.getPresenceSessions()) {
            if (session.getJoinAt() != null && session.getLeaveAt() != null) {
                if (!session.getJoinAt().isAfter(meetingStart) && !session.getLeaveAt().isBefore(meetingStart)) {
                    wasOnlineAtStart = true;
                    break;
                }
            }
        }

        // 현재 세션도 확인 (아직 종료되지 않은 세션)
        if (!wasOnlineAtStart && time.getCurrentSessionStart() != null) {
            if (!time.getCurrentSessionStart().isAfter(meetingStart)) {
                wasOnlineAtStart = true;
            }
        }

        // T0 시점에 접속 중이 아니었다면 LATE로 변경
        if (!wasOnlineAtStart && leaveTime.isAfter(meetingStart)) {
            record.setAttendanceType(AttendanceType.LATE);
        }
    }

    /**
     * 출석 확정 조건 확인 및 상태 업데이트
     */
    private void checkAndConfirmAttendance(AttendanceRecord record) {
        if (record.getStatus() == AttendanceStatus.CONFIRMED) {
            return;  // 이미 확정됨
        }

        if (record.meetsConfirmationCriteria()) {
            record.setStatus(AttendanceStatus.CONFIRMED);
        }
    }

    /**
     * 세션 종료 시 모든 참가자의 현재 발언/접속 정리
     */
    public void finalizeSessionAttendance(String sessionId) {
        LocalDateTime now = LocalDateTime.now();
        List<AttendanceRecord> records = attendanceRepository.findAllBySessionId(sessionId);

        for (AttendanceRecord record : records) {
            // 진행 중인 발언 종료
            if (record.getActivities().getCurrentSpeakStart() != null) {
                long speakDuration = Duration.between(
                        record.getActivities().getCurrentSpeakStart(), now
                ).getSeconds();
                record.getActivities().setSpeechSec(
                        record.getActivities().getSpeechSec() + speakDuration
                );
                record.getActivities().setCurrentSpeakStart(null);
            }

            // 진행 중인 접속 세션 종료
            TimeInfo time = record.getTime();
            if (time.getCurrentSessionStart() != null) {
                long sessionDuration = Duration.between(time.getCurrentSessionStart(), now).getSeconds();
                PresenceSession presenceSession = new PresenceSession(
                        time.getCurrentSessionStart(),
                        now,
                        sessionDuration
                );
                time.getPresenceSessions().add(presenceSession);
                time.setTotalPresenceSec(time.getTotalPresenceSec() + sessionDuration);
                time.setCurrentSessionStart(null);
            }

            time.setLastSeenAt(now);
            record.setUpdatedAt(now);

            // 최종 확정 체크
            checkAndConfirmAttendance(record);

            attendanceRepository.save(record);
        }
    }
}
