package com.bookclub.backend.suggestion.controller;

import com.bookclub.backend.suggestion.dto.*;
import com.bookclub.backend.suggestion.service.SuggestionService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/suggestions")
public class SuggestionController {

    @Autowired
    private SuggestionService suggestionService;

    // 토큰에서 userId 추출 헬퍼 메서드
    private String extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            String token = authHeader.substring(7);
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            return decodedToken.getUid();
        } catch (Exception e) {
            return null;
        }
    }

    // 건의사항 생성
    @PostMapping
    public ResponseEntity<?> createSuggestion(
            @RequestBody CreateSuggestionRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            SuggestionResponse response = suggestionService.createSuggestion(request, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 모든 건의사항 조회
    @GetMapping
    public ResponseEntity<?> getAllSuggestions(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            List<SuggestionResponse> suggestions = suggestionService.getAllSuggestions(userId);
            return ResponseEntity.ok(suggestions);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 상태별 건의사항 조회
    @GetMapping("/status/{status}")
    public ResponseEntity<?> getSuggestionsByStatus(
            @PathVariable String status,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            List<SuggestionResponse> suggestions = suggestionService.getSuggestionsByStatus(status, userId);
            return ResponseEntity.ok(suggestions);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단일 건의사항 조회
    @GetMapping("/{id}")
    public ResponseEntity<?> getSuggestionById(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            SuggestionResponse suggestion = suggestionService.getSuggestionById(id, userId);
            return ResponseEntity.ok(suggestion);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 추천(투표) 토글
    @PostMapping("/{id}/vote")
    public ResponseEntity<?> toggleVote(
            @PathVariable String id,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            SuggestionResponse response = suggestionService.toggleVote(id, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 댓글 생성
    @PostMapping("/{suggestionId}/comments")
    public ResponseEntity<?> createComment(
            @PathVariable String suggestionId,
            @RequestBody CreateCommentRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            CommentResponse response = suggestionService.createComment(suggestionId, request, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 댓글 목록 조회
    @GetMapping("/{suggestionId}/comments")
    public ResponseEntity<?> getComments(@PathVariable String suggestionId) {
        try {
            List<CommentResponse> comments = suggestionService.getComments(suggestionId);
            return ResponseEntity.ok(comments);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 댓글 삭제
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(
            @PathVariable String commentId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            suggestionService.deleteComment(commentId, userId);
            return ResponseEntity.ok(Map.of("message", "Comment deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 건의사항 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSuggestion(
            @PathVariable String id,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String userId = extractUserId(authHeader);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            suggestionService.deleteSuggestion(id, userId);
            return ResponseEntity.ok(Map.of("message", "Suggestion deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
