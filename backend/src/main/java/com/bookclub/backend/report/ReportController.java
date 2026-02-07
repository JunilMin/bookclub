// report/ReportController.java
package com.bookclub.backend.report;

import com.bookclub.backend.report.dto.CreateReportRequest;
import com.bookclub.backend.report.dto.CreateReportResponse;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "http://localhost:5173")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private UserRepository userRepository;

    /**
     * 신고 생성
     * POST /api/reports
     */
    @PostMapping
    public ResponseEntity<?> createReport(
            @RequestBody CreateReportRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // 1. Firebase 토큰에서 현재 사용자 정보 추출
            String token = authHeader.replace("Bearer ", "");
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            // 2. UID로 현재 사용자 조회
            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }
            String reporterUserId = userOpt.get().getId();

            // 3. Evidence 변환
            Report.Evidence evidence = null;
            if (request.getEvidenceFiles() != null && !request.getEvidenceFiles().isEmpty()) {
                evidence = new Report.Evidence();
                List<Report.Evidence.EvidenceFile> files = new ArrayList<>();
                for (CreateReportRequest.EvidenceFileDto fileDto : request.getEvidenceFiles()) {
                    Report.Evidence.EvidenceFile file = new Report.Evidence.EvidenceFile();
                    file.setUrl(fileDto.getUrl());
                    file.setName(fileDto.getName());
                    file.setContentType(fileDto.getContentType());
                    file.setSize(fileDto.getSize());
                    files.add(file);
                }
                evidence.setFiles(files);
            }

            // 4. 신고 생성
            Report report = reportService.createReport(
                    request.getSessionId(),
                    request.getPostId(),
                    reporterUserId,
                    request.getReportedUserId(),
                    request.getReasons(),
                    evidence
            );

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(CreateReportResponse.from(report));

        } catch (ReportService.ReportAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "code", "REPORT_ALREADY_SUBMITTED",
                            "message", e.getMessage()
                    ));
        } catch (ReportService.UnauthorizedReportException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "code", "UNAUTHORIZED_REPORT",
                            "message", e.getMessage()
                    ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                            "code", "INVALID_REQUEST",
                            "message", e.getMessage()
                    ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to create report: " + e.getMessage()
                    ));
        }
    }

    /**
     * 중복 신고 여부 확인
     * GET /api/reports/exists?sessionId=...&reportedUserId=...
     */
    @GetMapping("/exists")
    public ResponseEntity<?> checkReportExists(
            @RequestParam String sessionId,
            @RequestParam String reportedUserId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Firebase 토큰에서 현재 사용자 정보 추출
            String token = authHeader.replace("Bearer ", "");
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            // UID로 현재 사용자 조회
            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }
            String reporterUserId = userOpt.get().getId();

            boolean exists = reportService.checkReportExists(sessionId, reporterUserId, reportedUserId);

            return ResponseEntity.ok(Map.of("exists", exists));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to check report: " + e.getMessage()
                    ));
        }
    }

    /**
     * 특정 세션에서 현재 사용자가 이미 신고한 사용자 ID 목록 조회
     * GET /api/reports/reported-users?sessionId=...
     */
    @GetMapping("/reported-users")
    public ResponseEntity<?> getReportedUsers(
            @RequestParam String sessionId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Firebase 토큰에서 현재 사용자 정보 추출
            String token = authHeader.replace("Bearer ", "");
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            // UID로 현재 사용자 조회
            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }
            String reporterUserId = userOpt.get().getId();

            List<String> reportedUserIds = reportService.getReportedUserIdsByReporter(sessionId, reporterUserId);

            return ResponseEntity.ok(Map.of("reportedUserIds", reportedUserIds));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to get reported users: " + e.getMessage()
                    ));
        }
    }
}
