// report/ReportRepository.java
package com.bookclub.backend.report;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReportRepository extends MongoRepository<Report, String> {

    /**
     * 중복 신고 체크: 같은 세션에서 같은 신고자가 같은 대상을 신고했는지 확인
     */
    Optional<Report> findBySessionIdAndReporterUserIdAndReportedUserId(
            String sessionId, String reporterUserId, String reportedUserId);

    /**
     * 특정 세션의 모든 신고 조회
     */
    List<Report> findBySessionId(String sessionId);

    /**
     * 특정 사용자가 받은 모든 신고 조회
     */
    List<Report> findByReportedUserId(String reportedUserId);

    /**
     * 특정 사용자가 한 모든 신고 조회
     */
    List<Report> findByReporterUserId(String reporterUserId);

    /**
     * 중복 신고 존재 여부 확인
     */
    boolean existsBySessionIdAndReporterUserIdAndReportedUserId(
            String sessionId, String reporterUserId, String reportedUserId);
}
