package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.dto.ErrorResponse;
import com.bookclub.backend.session.dto.UserNoteResponse;
import com.bookclub.backend.session.model.UserSessionNote;
import com.bookclub.backend.session.service.UserSessionNoteService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/user-notes")
@CrossOrigin(origins = "http://localhost:5173")
public class UserSessionNoteController {

    @Autowired
    private UserSessionNoteService userSessionNoteService;

    @Autowired
    private UserRepository userRepository;

    /**
     * 현재 사용자의 모든 개인 노트 조회
     * GET /api/user-notes
     */
    @GetMapping
    public ResponseEntity<?> getMyNotes(HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            List<UserSessionNote> notes = userSessionNoteService.getUserNotes(userId);
            return ResponseEntity.ok(notes);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 현재 사용자의 모든 개인 노트 조회 (미팅 컨텍스트 포함)
     * GET /api/user-notes/enriched
     */
    @GetMapping("/enriched")
    public ResponseEntity<?> getMyNotesWithContext(HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            List<UserNoteResponse> notes = userSessionNoteService.getUserNotesWithContext(userId);
            return ResponseEntity.ok(notes);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 특정 개인 노트 조회 (미팅 컨텍스트 포함)
     * GET /api/user-notes/{noteId}/enriched
     */
    @GetMapping("/{noteId}/enriched")
    public ResponseEntity<?> getNoteWithContext(
            @PathVariable String noteId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            UserNoteResponse note = userSessionNoteService.getNoteWithContext(noteId, userId);
            return ResponseEntity.ok(note);

        } catch (UserSessionNoteService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (UserSessionNoteService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 특정 개인 노트 조회
     * GET /api/user-notes/{noteId}
     */
    @GetMapping("/{noteId}")
    public ResponseEntity<?> getNoteById(
            @PathVariable String noteId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            Optional<UserSessionNote> noteOpt = userSessionNoteService.getNoteById(noteId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Note not found", "NOT_FOUND"));
            }

            UserSessionNote note = noteOpt.get();

            // 본인 노트만 조회 가능
            if (!note.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("You don't have permission to view this note", "FORBIDDEN"));
            }

            return ResponseEntity.ok(note);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 특정 세션의 내 개인 노트 조회
     * GET /api/user-notes/session/{sessionId}
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<?> getNoteBySession(
            @PathVariable String sessionId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            Optional<UserSessionNote> noteOpt = userSessionNoteService.getUserNoteForSession(sessionId, userId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Note not found for this session", "NOT_FOUND"));
            }

            return ResponseEntity.ok(noteOpt.get());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 개인 노트 내용 업데이트
     * PUT /api/user-notes/{noteId}/content
     */
    @PutMapping("/{noteId}/content")
    public ResponseEntity<?> updateNoteContent(
            @PathVariable String noteId,
            @RequestBody Map<String, String> body,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            String content = body.get("content");
            if (content == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Content is required", "BAD_REQUEST"));
            }

            UserSessionNote updatedNote = userSessionNoteService.updateNoteContent(noteId, userId, content);
            return ResponseEntity.ok(updatedNote);

        } catch (UserSessionNoteService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (UserSessionNoteService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 개인 노트 제목 업데이트
     * PUT /api/user-notes/{noteId}/title
     */
    @PutMapping("/{noteId}/title")
    public ResponseEntity<?> updateNoteTitle(
            @PathVariable String noteId,
            @RequestBody Map<String, String> body,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            String title = body.get("title");
            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Title is required", "BAD_REQUEST"));
            }

            UserSessionNote updatedNote = userSessionNoteService.updateNoteTitle(noteId, userId, title.trim());
            return ResponseEntity.ok(updatedNote);

        } catch (UserSessionNoteService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (UserSessionNoteService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 개인 노트 삭제
     * DELETE /api/user-notes/{noteId}
     */
    @DeleteMapping("/{noteId}")
    public ResponseEntity<?> deleteNote(
            @PathVariable String noteId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            userSessionNoteService.deleteNote(noteId, userId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Note deleted successfully"));

        } catch (UserSessionNoteService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (UserSessionNoteService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 세션 노트를 수동으로 fork (세션 종료 후 뒤늦게 요청하는 경우)
     * POST /api/user-notes/fork/{sessionId}
     */
    @PostMapping("/fork/{sessionId}")
    public ResponseEntity<?> forkNoteFromSession(
            @PathVariable String sessionId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            UserSessionNote userNote = userSessionNoteService.forkNoteToUser(sessionId, userId);
            return ResponseEntity.ok(userNote);

        } catch (UserSessionNoteService.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage(), "NOT_FOUND"));
        } catch (UserSessionNoteService.ForbiddenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(e.getMessage(), "FORBIDDEN"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * Authorization 헤더 또는 쿠키에서 사용자 ID 추출
     */
    private String extractUserId(HttpServletRequest request) {
        String token = extractToken(request);
        if (token == null) return null;

        try {
            // "Bearer " 접두사 제거
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            // UID로 사용자 조회
            Optional<User> userOpt = userRepository.findByUid(uid);
            return userOpt.map(User::getId).orElse(null);

        } catch (FirebaseAuthException e) {
            return null;
        }
    }

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
