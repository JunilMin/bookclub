package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 출석 기록 모델
 * 각 참가자별 1문서로 저장 (postId + sessionId + userId 조합이 unique)
 */
@Document(collection = "attendance_records")
@CompoundIndexes({
    @CompoundIndex(name = "session_user_idx", def = "{'sessionId': 1, 'userId': 1}", unique = true),
    @CompoundIndex(name = "post_user_idx", def = "{'postId': 1, 'userId': 1}"),
    @CompoundIndex(name = "user_idx", def = "{'userId': 1}")
})
@Getter
@Setter
@NoArgsConstructor
public class AttendanceRecord {

    @Id
    private String id;

    private String postId;      // 연결된 Post ID
    private String sessionId;   // 연결된 Session ID
    private String userId;      // 참가자 User ID
    private String username;    // 참가자 이름 (조회 편의)
    private String photoUrl;    // 참가자 프로필 사진

    // 시간 정보
    private TimeInfo time;

    // 활동 정보
    private ActivityInfo activities;

    // 출석 유형: EARLY, ON_TIME, LATE
    private AttendanceType attendanceType;

    // 상태: PENDING, CONFIRMED
    private AttendanceStatus status;

    // 마일스톤 (어떤 활동을 달성했는지)
    private Milestones milestones;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public AttendanceRecord(String postId, String sessionId, String userId, String username, String photoUrl) {
        this.postId = postId;
        this.sessionId = sessionId;
        this.userId = userId;
        this.username = username;
        this.photoUrl = photoUrl;
        this.time = new TimeInfo();
        this.activities = new ActivityInfo();
        this.status = AttendanceStatus.PENDING;
        this.milestones = new Milestones();
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 시간 관련 정보
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class TimeInfo {
        private LocalDateTime startAt;          // post.due (미팅 시작 시각)
        private LocalDateTime firstJoinAt;      // 최초 입장 시각
        private LocalDateTime lastSeenAt;       // 마지막 활동 시각
        private long totalPresenceSec;          // 누적 접속 시간 (초)

        // 재접속 시 누적 계산용
        private LocalDateTime currentSessionStart;  // 현재 접속 세션 시작
        private List<PresenceSession> presenceSessions = new ArrayList<>();
    }

    /**
     * 개별 접속 세션 (입장~퇴장)
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class PresenceSession {
        private LocalDateTime joinAt;
        private LocalDateTime leaveAt;
        private long durationSec;

        public PresenceSession(LocalDateTime joinAt, LocalDateTime leaveAt, long durationSec) {
            this.joinAt = joinAt;
            this.leaveAt = leaveAt;
            this.durationSec = durationSec;
        }
    }

    /**
     * 활동 정보
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ActivityInfo {
        private long speechSec;                 // 누적 발언 시간 (초)
        private int noteCharCount;              // 노트 글자수 (누적 기준, 삭제 시 감소하지 않음)
        private int noteCharCountCurrent;       // 현재 노트 글자수 (삭제 시 감소)
        private LocalDateTime handRaisedAt;     // 손들기 시각 (가장 최근)
        private int handRaiseCount;             // 손들기 횟수
        private int speakCount;                 // 발언 횟수

        // 현재 발언 중인 경우 추적
        private LocalDateTime currentSpeakStart;
    }

    /**
     * 마일스톤 달성 여부
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Milestones {
        private boolean joined;         // 입장 완료
        private boolean spoke;          // 발언 경험
        private boolean noted;          // 노트 작성 경험
        private boolean handRaised;     // 손들기 경험

        private LocalDateTime joinedAt;
        private LocalDateTime spokeAt;
        private LocalDateTime notedAt;
        private LocalDateTime handRaisedAt;
    }

    /**
     * 출석 유형
     */
    public enum AttendanceType {
        EARLY,      // T0 이전 입장 + T0까지 연결 유지
        ON_TIME,    // T0 ~ T0+W 윈도우에 입장
        LATE        // T0+W 이후 입장
    }

    /**
     * 출석 상태
     */
    public enum AttendanceStatus {
        PENDING,    // 조건 미충족
        CONFIRMED   // 출석 확정
    }

    // ============== 편의 메서드 ==============

    /**
     * 출석 확정 조건 계산 (손들기 여부에 따라 기준 조정)
     * - 기본: 발언 120초 OR 노트 25자
     * - 손들기 시: 발언 96초 OR 노트 20자 (20% 완화)
     */
    public boolean meetsConfirmationCriteria() {
        if (activities == null) return false;

        boolean hasRaisedHand = milestones != null && milestones.isHandRaised();

        // 손들기 시 20% 완화
        int requiredSpeechSec = hasRaisedHand ? 96 : 120;   // 2분 or 1분36초
        int requiredNoteChars = hasRaisedHand ? 20 : 25;

        return activities.getSpeechSec() >= requiredSpeechSec
            || activities.getNoteCharCount() >= requiredNoteChars;
    }

    /**
     * 출석 확정 진행률 계산 (0.0 ~ 1.0)
     */
    public double getConfirmationProgress() {
        if (activities == null) return 0.0;

        boolean hasRaisedHand = milestones != null && milestones.isHandRaised();

        int requiredSpeechSec = hasRaisedHand ? 96 : 120;
        int requiredNoteChars = hasRaisedHand ? 20 : 25;

        double speechProgress = Math.min(1.0, (double) activities.getSpeechSec() / requiredSpeechSec);
        double noteProgress = Math.min(1.0, (double) activities.getNoteCharCount() / requiredNoteChars);

        // 둘 중 높은 진행률 반환
        return Math.max(speechProgress, noteProgress);
    }

    /**
     * 확정까지 남은 발언 시간 (초)
     */
    public int getRemainingSpechSec() {
        if (activities == null) return 120;
        boolean hasRaisedHand = milestones != null && milestones.isHandRaised();
        int required = hasRaisedHand ? 96 : 120;
        return Math.max(0, required - (int) activities.getSpeechSec());
    }

    /**
     * 확정까지 남은 노트 글자수
     */
    public int getRemainingNoteChars() {
        if (activities == null) return 25;
        boolean hasRaisedHand = milestones != null && milestones.isHandRaised();
        int required = hasRaisedHand ? 20 : 25;
        return Math.max(0, required - activities.getNoteCharCount());
    }
}
