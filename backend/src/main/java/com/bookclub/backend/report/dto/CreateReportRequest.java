// report/dto/CreateReportRequest.java
package com.bookclub.backend.report.dto;

import com.bookclub.backend.report.Report;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class CreateReportRequest {
    private String sessionId;
    private String postId;
    private String reportedUserId;
    private List<Report.ReportReason> reasons;
    private List<EvidenceFileDto> evidenceFiles;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class EvidenceFileDto {
        private String url;
        private String name;
        private String contentType;
        private long size;
    }
}
