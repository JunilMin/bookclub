// report/dto/CreateReportResponse.java
package com.bookclub.backend.report.dto;

import com.bookclub.backend.report.Report;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateReportResponse {
    private String reportId;
    private Report.ReportStatus status;
    private LocalDateTime createdAt;

    public static CreateReportResponse from(Report report) {
        return new CreateReportResponse(
                report.getId(),
                report.getStatus(),
                report.getCreatedAt()
        );
    }
}
