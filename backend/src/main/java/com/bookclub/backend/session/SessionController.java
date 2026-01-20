// backend/src/main/java/com/bookclub/backend/session/SessionController.java
package com.bookclub.backend.session;

import com.bookclub.backend.session.dto.ErrorResponse;
import com.bookclub.backend.session.dto.GetSessionResponse;
import com.bookclub.backend.session.dto.JoinSessionRequest;
import com.bookclub.backend.session.dto.JoinSessionResponse;
import com.bookclub.backend.session.dto.NoteSummaryResponse;
import com.bookclub.backend.session.service.SpeakingQueueService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class SessionController {

    @Autowired
    private SessionService sessionService;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private SpeakingQueueService speakingQueueService;

    /**
     * 세션 참가 (없으면 생성, 있으면 재사용)
     * POST /api/sessions/join
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinSession(
            @RequestBody JoinSessionRequest request,
            HttpServletRequest httpRequest) {
        try {
            String token = extractToken(httpRequest);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            JoinSessionResponse response = sessionService.joinSession(request.getPostId(), token);
            return ResponseEntity.ok(response);

        } catch (SessionService.UnauthorizedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(e.getMessage(), "UNAUTHORIZED"));
        } catch (SessionService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (SessionService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (SessionService.MeetingEndedException e) {
            return ResponseEntity.status(HttpStatus.GONE)
                .body(new ErrorResponse(e.getMessage(), "MEETING_ENDED"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 세션 조회
     * GET /api/sessions/{sessionId}
     */
    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(
            @PathVariable String sessionId,
            HttpServletRequest httpRequest) {
        try {
            String token = extractToken(httpRequest);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            GetSessionResponse response = sessionService.getSession(sessionId, token);
            return ResponseEntity.ok(response);

        } catch (SessionService.UnauthorizedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(e.getMessage(), "UNAUTHORIZED"));
        } catch (SessionService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (SessionService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 여러 Post의 활성 참가자 수 조회
     * GET /api/sessions/room-statuses?postIds=id1,id2,id3
     */
    @GetMapping("/room-statuses")
    public ResponseEntity<?> getRoomStatuses(
            @RequestParam List<String> postIds,
            HttpServletRequest httpRequest) {
        try {
            String token = extractToken(httpRequest);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            Map<String, Map<String, Object>> result = new HashMap<>();

            for (String postId : postIds) {
                Map<String, Object> status = new HashMap<>();

                // Find session for this post
                Optional<Session> sessionOpt = sessionRepository.findByPostId(postId);

                if (sessionOpt.isPresent()) {
                    String sessionId = sessionOpt.get().getId();
                    int activeParticipants = speakingQueueService.getOnlineParticipantCount(sessionId);
                    status.put("activeParticipants", activeParticipants);
                    status.put("sessionId", sessionId);
                } else {
                    status.put("activeParticipants", 0);
                    status.put("sessionId", null);
                }

                result.put(postId, status);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 사용자가 참여한 모든 세션의 AI 요약 목록 조회
     * GET /api/sessions/my-summaries
     */
    @GetMapping("/my-summaries")
    public ResponseEntity<?> getMySummaries(HttpServletRequest httpRequest) {
        try {
            String token = extractToken(httpRequest);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            List<NoteSummaryResponse> summaries = sessionService.getUserSummaries(token);
            return ResponseEntity.ok(summaries);

        } catch (SessionService.UnauthorizedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(e.getMessage(), "UNAUTHORIZED"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * Authorization 헤더 또는 쿠키에서 토큰 추출
     */
    private String extractToken(HttpServletRequest request) {
        // 1. Authorization 헤더에서 추출
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader;
        }

        // 2. 쿠키에서 추출
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("firebase_token".equals(cookie.getName())) {
                    return "Bearer " + cookie.getValue();
                }
            }
        }

        return null;
    }
}
