// report/ReportService.java
package com.bookclub.backend.report;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ReportService {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * 신고 생성
     * @throws ReportAlreadyExistsException 중복 신고 시
     * @throws UnauthorizedReportException 권한 없음 시
     */
    public Report createReport(
            String sessionId,
            String postId,
            String reporterUserId,
            String reportedUserId,
            List<Report.ReportReason> reasons,
            Report.Evidence evidence
    ) {
        // 1. 중복 신고 체크
        if (reportRepository.existsBySessionIdAndReporterUserIdAndReportedUserId(
                sessionId, reporterUserId, reportedUserId)) {
            throw new ReportAlreadyExistsException("You already reported this user in this session.");
        }

        // 2. 세션 존재 확인
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            throw new IllegalArgumentException("Session not found");
        }

        // 3. 포스트 존재 및 권한 확인
        String actualPostId = postId != null ? postId : sessionOpt.get().getPostId();
        Optional<Post> postOpt = postRepository.findById(actualPostId);
        if (postOpt.isEmpty()) {
            throw new IllegalArgumentException("Post not found");
        }

        Post post = postOpt.get();

        // 4. 신고자가 해당 세션의 멤버인지 확인
        boolean isReporterMember = post.getMemberIds() != null &&
                post.getMemberIds().contains(reporterUserId);
        boolean isReporterCreator = reporterUserId.equals(post.getCreaterId());

        if (!isReporterMember && !isReporterCreator) {
            throw new UnauthorizedReportException("You are not a member of this meeting.");
        }

        // 5. 신고 대상이 해당 세션의 멤버인지 확인
        boolean isReportedMember = post.getMemberIds() != null &&
                post.getMemberIds().contains(reportedUserId);
        boolean isReportedCreator = reportedUserId.equals(post.getCreaterId());

        if (!isReportedMember && !isReportedCreator) {
            throw new IllegalArgumentException("Reported user is not a member of this meeting.");
        }

        // 6. 자기 자신 신고 방지
        if (reporterUserId.equals(reportedUserId)) {
            throw new IllegalArgumentException("You cannot report yourself.");
        }

        // 7. 신고 생성
        Report report = new Report(actualPostId, sessionId, reporterUserId, reportedUserId, reasons);
        if (evidence != null) {
            report.setEvidence(evidence);
        }
        Report savedReport = reportRepository.save(report);

        // 8. 신고당한 사용자의 reported 집계 업데이트
        updateUserReportedStats(reportedUserId, reasons);

        return savedReport;
    }

    /**
     * 중복 신고 여부 확인
     */
    public boolean checkReportExists(String sessionId, String reporterUserId, String reportedUserId) {
        return reportRepository.existsBySessionIdAndReporterUserIdAndReportedUserId(
                sessionId, reporterUserId, reportedUserId);
    }

    /**
     * 특정 세션에서 신고자가 이미 신고한 사용자 ID 목록 조회
     */
    public List<String> getReportedUserIdsByReporter(String sessionId, String reporterUserId) {
        return reportRepository.findBySessionId(sessionId).stream()
                .filter(r -> r.getReporterUserId().equals(reporterUserId))
                .map(Report::getReportedUserId)
                .distinct()
                .toList();
    }

    /**
     * 신고당한 사용자의 reported 통계 업데이트
     */
    private void updateUserReportedStats(String reportedUserId, List<Report.ReportReason> reasons) {
        try {
            Optional<User> userOpt = userRepository.findById(new ObjectId(reportedUserId));
            if (userOpt.isPresent()) {
                User user = userOpt.get();

                // reported 필드 초기화 (없으면)
                if (user.getReported() == null) {
                    user.setReported(new User.ReportedStats(0));
                }

                // 카운트 증가
                user.getReported().incrementCount();

                // 각 사유별 카운트 증가
                for (Report.ReportReason reason : reasons) {
                    user.getReported().incrementReasonCount(reason.name());
                }

                userRepository.save(user);
            }
        } catch (Exception e) {
            // 통계 업데이트 실패해도 신고 자체는 성공으로 처리
            System.err.println("Failed to update user reported stats: " + e.getMessage());
        }
    }

    /**
     * 중복 신고 예외
     */
    public static class ReportAlreadyExistsException extends RuntimeException {
        public ReportAlreadyExistsException(String message) {
            super(message);
        }
    }

    /**
     * 권한 없음 예외
     */
    public static class UnauthorizedReportException extends RuntimeException {
        public UnauthorizedReportException(String message) {
            super(message);
        }
    }
}
