package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.model.AttendanceRecord;
import com.bookclub.backend.session.service.AttendanceService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class AttendanceController {

    private static final Logger logger = LoggerFactory.getLogger(AttendanceController.class);

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * 세션의 모든 출석 기록 조회
     */
    @GetMapping("/{sessionId}/attendance")
    public ResponseEntity<?> getSessionAttendance(
            @PathVariable String sessionId,
            HttpServletRequest request) {
        try {
            String token = extractToken(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token required"));
            }

            // 토큰 검증만 수행 (세부 권한은 생략 - 참가자면 조회 가능)
            String uid = extractUidFromToken(token);
            if (uid == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            List<AttendanceRecord> records = attendanceService.getSessionAttendance(sessionId);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            logger.error("Error getting session attendance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 현재 사용자의 세션 출석 기록 조회 (없으면 자동 생성)
     */
    @GetMapping("/{sessionId}/attendance/me")
    public ResponseEntity<?> getMyAttendance(
            @PathVariable String sessionId,
            HttpServletRequest request) {
        try {
            String token = extractToken(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token required"));
            }

            String uid = extractUidFromToken(token);
            if (uid == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            // UID로 사용자 조회
            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "User not found"));
            }
            User user = userOpt.get();
            String userId = user.getId();

            logger.info("[getMyAttendance] Looking for existing attendance - sessionId: {}, userId: {}", sessionId, userId);

            // 기존 기록 조회
            Optional<AttendanceRecord> existingRecord = attendanceService.getUserAttendance(sessionId, userId);
            if (existingRecord.isPresent()) {
                logger.info("[getMyAttendance] Found existing record - id: {}, status: {}",
                    existingRecord.get().getId(), existingRecord.get().getStatus());
                return ResponseEntity.ok(existingRecord.get());
            }

            // 기록이 없으면 자동 생성 (getOrCreate 패턴)
            logger.info("[getMyAttendance] No existing record found. Creating new one for user {} in session {}", userId, sessionId);
            AttendanceRecord newRecord = attendanceService.handleJoin(
                    sessionId,
                    userId,
                    user.getUsername(),
                    user.getDisplayPhotoUrl()
            );

            // 새로 생성된 출석 기록 브로드캐스트
            if (newRecord != null) {
                logger.info("[getMyAttendance] Created new record - id: {}", newRecord.getId());
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", newRecord);
            } else {
                logger.warn("[getMyAttendance] handleJoin returned null for sessionId: {}, userId: {}", sessionId, userId);
            }

            return ResponseEntity.ok(newRecord);
        } catch (IllegalArgumentException e) {
            logger.error("[getMyAttendance] Invalid session for attendance - sessionId: {}, error: {}", sessionId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            logger.error("[getMyAttendance] Duplicate key error - sessionId: {}, error: {}", sessionId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Duplicate attendance record detected. Please retry."));
        } catch (Exception e) {
            logger.error("[getMyAttendance] Unexpected error - sessionId: {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }
    }

    /**
     * 사용자의 출석 히스토리 조회
     */
    @GetMapping("/attendance/history")
    public ResponseEntity<?> getAttendanceHistory(HttpServletRequest request) {
        try {
            String token = extractToken(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token required"));
            }

            String uid = extractUidFromToken(token);
            if (uid == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "User not found"));
            }
            String userId = userOpt.get().getId();

            List<AttendanceRecord> records = attendanceService.getUserAttendanceHistory(userId);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            logger.error("Error getting attendance history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 사용자의 확정된 출석만 조회
     */
    @GetMapping("/attendance/confirmed")
    public ResponseEntity<?> getConfirmedAttendance(HttpServletRequest request) {
        try {
            String token = extractToken(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token required"));
            }

            String uid = extractUidFromToken(token);
            if (uid == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "User not found"));
            }
            String userId = userOpt.get().getId();

            List<AttendanceRecord> records = attendanceService.getUserConfirmedAttendance(userId);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            logger.error("Error getting confirmed attendance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 노트 업데이트 시 출석 기록 갱신 (프론트엔드에서 호출)
     */
    @PostMapping("/{sessionId}/attendance/note-update")
    public ResponseEntity<?> updateNoteAttendance(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        try {
            String token = extractToken(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token required"));
            }

            String uid = extractUidFromToken(token);
            if (uid == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "User not found"));
            }
            String userId = userOpt.get().getId();

            Object charCountObj = body.get("charCount");
            if (charCountObj == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "charCount is required"));
            }
            int charCount = ((Number) charCountObj).intValue();

            AttendanceRecord record = attendanceService.handleNoteUpdate(sessionId, userId, charCount);
            if (record == null) {
                // 출석 기록이 없음 - 아직 세션에 참가하지 않은 상태
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Attendance record not found. Please join the session first."));
            }

            // 출석 상태 변경 시 브로드캐스트
            broadcastAttendanceUpdate(sessionId, record);

            return ResponseEntity.ok(record);
        } catch (Exception e) {
            logger.error("Error updating note attendance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 출석 상태 변경 시 WebSocket으로 브로드캐스트
     */
    private void broadcastAttendanceUpdate(String sessionId, AttendanceRecord record) {
        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId + "/attendance",
                record
        );
    }

    // ============== 헬퍼 메서드 ==============

    private String extractToken(HttpServletRequest request) {
        // 1. Authorization 헤더에서 추출
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        // 2. 쿠키에서 추출
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }

    private String extractUidFromToken(String token) {
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            return decodedToken.getUid();
        } catch (FirebaseAuthException e) {
            logger.error("Token verification failed", e);
            return null;
        }
    }
}
