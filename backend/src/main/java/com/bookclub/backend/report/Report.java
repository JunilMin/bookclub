// report/Report.java
package com.bookclub.backend.report;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "reports")
@CompoundIndex(name = "unique_report", def = "{'sessionId': 1, 'reporterUserId': 1, 'reportedUserId': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
public class Report {

    @Id
    private String id;

    private String postId;           // 관련 Post ID
    private String sessionId;        // 세션 ID

    private String reporterUserId;   // 신고자 User ID
    private String reportedUserId;   // 신고당한 User ID

    private List<ReportReason> reasons;  // 신고 사유 (다중 선택)

    private Evidence evidence;       // 증거 파일

    private LocalDateTime createdAt;
    private ReportStatus status;

    public Report(String postId, String sessionId, String reporterUserId, String reportedUserId, List<ReportReason> reasons) {
        this.postId = postId;
        this.sessionId = sessionId;
        this.reporterUserId = reporterUserId;
        this.reportedUserId = reportedUserId;
        this.reasons = reasons;
        this.createdAt = LocalDateTime.now();
        this.status = ReportStatus.OPEN;
    }

    // 신고 사유 Enum
    public enum ReportReason {
        ABUSE,           // 욕설/괴롭힘
        HATE,            // 혐오/차별 발언
        SEXUAL,          // 성희롱/불쾌한 발언
        SPAM_ADS,        // 진행 방해/트롤링/스팸/광고
        PRIVACY_SAFETY,  // 개인정보 노출/안전 이슈
        INACTIVE         // 장기간 비활동
    }

    // 신고 상태 Enum
    public enum ReportStatus {
        OPEN,       // 접수됨
        REVIEWED,   // 검토됨
        RESOLVED,   // 처리 완료
        DISMISSED   // 기각
    }

    // 증거 파일 클래스
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Evidence {
        private List<EvidenceFile> files;

        @Getter
        @Setter
        @NoArgsConstructor
        public static class EvidenceFile {
            private String url;
            private String name;
            private String contentType;
            private long size;
        }
    }
}
