package com.bookclub.backend.post;

import com.bookclub.backend.post.dto.EndPostResponse;
import com.bookclub.backend.session.dto.KickEventMessage;
import com.bookclub.backend.session.dto.MeetingEndedMessage;
import com.bookclub.backend.session.service.AttendanceService;
import com.bookclub.backend.session.service.UserSessionNoteService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;
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
@RequestMapping("/api/posts")
@CrossOrigin(origins = "http://localhost:5173")
public class PostController {

    private static final Logger logger = LoggerFactory.getLogger(PostController.class);

    @Autowired
    private PostService postService;

    @Autowired
    private UserService userService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserSessionNoteService userSessionNoteService;

    @Autowired
    private AttendanceService attendanceService;

    /**
     * 모든 게시물 조회 (강퇴된 사용자에게는 해당 게시물 미표시)
     * @param userId 현재 사용자 ID (선택적)
     */
    @GetMapping
    public List<Post> getAllPosts(@RequestParam(required = false) String userId) {
        if (userId != null && !userId.isEmpty()) {
            return postService.getAllPostsExcludingBlocked(userId);
        }
        return postService.getAllPosts();
    }

    /**
     * ID로 게시물 조회
     */
    @GetMapping("/{id}")
    public ResponseEntity<Post> getPostById(@PathVariable String id) {
        try {
            Optional<Post> post = postService.getPostById(id);
            return post.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 게시물 생성 (Google Meet 링크 자동 생성)
     * @param post 생성할 게시물
     * google_access_token은 httpOnly 쿠키에서 읽어옴
     */
    @PostMapping
    public ResponseEntity<Post> createPost(
            @RequestBody Post post,
            HttpServletRequest request) {
        // 쿠키에서 google_access_token 읽기
        String googleAccessToken = getGoogleAccessTokenFromCookie(request);
        Post createdPost = postService.createPost(post, googleAccessToken);
        return ResponseEntity.ok(createdPost);
    }

    /**
     * 쿠키에서 google_access_token 추출
     */
    private String getGoogleAccessTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("google_access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * 게시물 업데이트 (Google Calendar 동기화 포함)
     * 시간(due) 또는 제목(book)이 변경되면 Google Calendar 이벤트도 업데이트됨
     */
    @PutMapping("/{id}")
    public ResponseEntity<Post> updatePost(
            @PathVariable String id,
            @RequestBody Post updatedPost,
            HttpServletRequest request) {
        try {
            // 쿠키에서 google_access_token 읽기
            String googleAccessToken = getGoogleAccessTokenFromCookie(request);
            Post updated = postService.updatePost(id, updatedPost, googleAccessToken);
            if (updated != null) {
                return ResponseEntity.ok(updated);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build(); // 유효하지 않은 형식에 대한 예외 처리
        }
    }

    /**
     * 게시물의 bookData만 업데이트 (기존 Post에 bookData가 없을 때 사용)
     */
    @PatchMapping("/{id}/book-data")
    public ResponseEntity<Post> updateBookData(
            @PathVariable String id,
            @RequestBody Post.BookData bookData) {
        try {
            Post updated = postService.updateBookData(id, bookData);
            if (updated != null) {
                return ResponseEntity.ok(updated);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 게시물 삭제 (Google Calendar 이벤트도 함께 삭제)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable String id, HttpServletRequest request) {
        try {
            // 쿠키에서 google_access_token 읽기
            String googleAccessToken = getGoogleAccessTokenFromCookie(request);
            postService.deletePost(id, googleAccessToken);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 북미팅 참여 (OPEN: 바로 가입, APPROVAL: 대기열에 추가)
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<?> joinBookMeeting(
            @PathVariable String id,
            @RequestParam String userId) {
        try {
            Post post = postService.joinBookMeeting(id, userId);
            return ResponseEntity.ok(post);
        } catch (PostService.MeetingEndedException e) {
            return ResponseEntity.status(HttpStatus.GONE)
                .body(Map.of("code", "MEETING_ENDED", "message", e.getMessage()));
        } catch (PostService.JoinRequestAlreadyPendingException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("code", "JOIN_REQUEST_PENDING", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    /**
     * 북미팅 참여 취소
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<Post> leaveBookMeeting(
            @PathVariable String id,
            @RequestParam String userId) {
        try {
            Post post = postService.leaveBookMeeting(id, userId);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 멤버 강퇴 (방장만 가능)
     * @param id 게시물 ID
     * @param targetUserId 강퇴할 유저 ID
     * @param requesterId 요청자 ID (방장)
     * @param sessionId 세션 ID (WebSocket 브로드캐스트용, 선택)
     */
    @PostMapping("/{id}/kick")
    public ResponseEntity<?> kickMember(
            @PathVariable String id,
            @RequestParam String targetUserId,
            @RequestParam String requesterId,
            @RequestParam(required = false) String sessionId) {
        try {
            // 강퇴 전에 유저 정보 조회 (username 얻기 위해)
            String kickedUsername = "Unknown";
            try {
                Optional<User> targetUser = userService.getUserByIdString(targetUserId);
                if (targetUser.isPresent()) {
                    kickedUsername = targetUser.get().getUsername();
                }
            } catch (Exception e) {
                // username 조회 실패해도 강퇴는 진행
            }

            Post post = postService.kickMember(id, targetUserId, requesterId);

            // WebSocket으로 강퇴 이벤트 브로드캐스트 (sessionId가 있는 경우)
            if (sessionId != null && !sessionId.isEmpty()) {
                KickEventMessage kickEvent = new KickEventMessage(
                        targetUserId,
                        kickedUsername,
                        "Kicked by room creator"
                );
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/kick", kickEvent);
            }

            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * 강퇴 유저 복구 (방장만 가능)
     * @param id 게시물 ID
     * @param targetUserId 복구할 유저 ID
     * @param requesterId 요청자 ID (방장)
     */
    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restoreMember(
            @PathVariable String id,
            @RequestParam String targetUserId,
            @RequestParam String requesterId) {
        try {
            Post post = postService.restoreMember(id, targetUserId, requesterId);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * 가입 신청 승인 (방장만 가능)
     */
    @PostMapping("/{id}/approve-join")
    public ResponseEntity<?> approveJoinRequest(
            @PathVariable String id,
            @RequestParam String targetUserId,
            @RequestParam String requesterId) {
        try {
            Post post = postService.approveJoinRequest(id, targetUserId, requesterId);
            return ResponseEntity.ok(post);
        } catch (PostService.PostNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", "POST_NOT_FOUND", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    /**
     * 가입 신청 거절 (방장만 가능)
     */
    @PostMapping("/{id}/reject-join")
    public ResponseEntity<?> rejectJoinRequest(
            @PathVariable String id,
            @RequestParam String targetUserId,
            @RequestParam String requesterId) {
        try {
            Post post = postService.rejectJoinRequest(id, targetUserId, requesterId);
            return ResponseEntity.ok(post);
        } catch (PostService.PostNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", "POST_NOT_FOUND", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    /**
     * 가입 신청 취소 (본인)
     */
    @PostMapping("/{id}/cancel-join-request")
    public ResponseEntity<?> cancelJoinRequest(
            @PathVariable String id,
            @RequestParam String userId) {
        try {
            Post post = postService.cancelJoinRequest(id, userId);
            return ResponseEntity.ok(post);
        } catch (PostService.PostNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", "POST_NOT_FOUND", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    /**
     * 미팅 종료 (호스트만 가능)
     * Idempotent: 이미 종료된 경우 동일한 응답 반환
     * @param id 게시물 ID
     * @param requesterId 요청자 ID (호스트)
     * @param sessionId 세션 ID (WebSocket 브로드캐스트용, 선택)
     */
    @PostMapping("/{id}/end")
    public ResponseEntity<?> endMeeting(
            @PathVariable String id,
            @RequestParam String requesterId,
            @RequestParam(required = false) String sessionId) {
        try {
            Post post = postService.endPost(id, requesterId);

            // WebSocket으로 미팅 종료 이벤트 브로드캐스트 (sessionId가 있는 경우)
            if (sessionId != null && !sessionId.isEmpty() && post.getEnd() != null) {
                MeetingEndedMessage endedMessage = new MeetingEndedMessage(
                    post.getId(),
                    post.getEnd().getEndedAt(),
                    post.getEnd().getEndedBy()
                );
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/ended", endedMessage);

                // 세션 종료 시 공용 노트를 모든 참가자에게 fork
                try {
                    userSessionNoteService.forkNotesToParticipants(sessionId);
                    logger.info("Forked session notes to participants for session: {}", sessionId);
                } catch (Exception e) {
                    logger.error("Failed to fork notes to participants for session {}: {}", sessionId, e.getMessage());
                    // Note forking 실패해도 미팅 종료는 성공으로 처리
                }

                // 세션 종료 시 출석 기록 최종화
                try {
                    attendanceService.finalizeSessionAttendance(sessionId);
                    logger.info("Finalized attendance for session: {}", sessionId);
                } catch (Exception e) {
                    logger.error("Failed to finalize attendance for session {}: {}", sessionId, e.getMessage());
                    // 출석 기록 최종화 실패해도 미팅 종료는 성공으로 처리
                }
            }

            EndPostResponse response = EndPostResponse.from(
                post.getId(),
                post.getEnd() != null && post.getEnd().isEnded(),
                post.getEnd() != null ? post.getEnd().getEndedAt() : null,
                post.getEnd() != null ? post.getEnd().getEndedBy() : null
            );

            return ResponseEntity.ok(response);
        } catch (PostService.PostNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", "POST_NOT_FOUND", "message", e.getMessage()));
        } catch (PostService.UnauthorizedEndException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("code", "UNAUTHORIZED", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }
}
