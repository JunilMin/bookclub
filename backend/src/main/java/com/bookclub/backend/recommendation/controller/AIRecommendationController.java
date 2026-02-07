package com.bookclub.backend.recommendation.controller;

import com.bookclub.backend.recommendation.dto.AIRecommendationResponse;
import com.bookclub.backend.recommendation.dto.ClickRequest;
import com.bookclub.backend.recommendation.dto.FeedbackRequest;
import com.bookclub.backend.recommendation.model.AIRecommendationCache;
import com.bookclub.backend.recommendation.model.AIRecommendationClick;
import com.bookclub.backend.recommendation.model.AIRecommendationFeedback;
import com.bookclub.backend.recommendation.service.AIRecommendationService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * AI 추천 API Controller
 * 추천 조회, 재생성, 피드백 관리
 */
@RestController
@RequestMapping("/api/users/me/ai-recommendations")
@RequiredArgsConstructor
public class AIRecommendationController {

    private static final Logger logger = LoggerFactory.getLogger(AIRecommendationController.class);

    private final AIRecommendationService aiRecommendationService;
    private final UserService userService;

    /**
     * AI 추천 조회 (캐시 또는 자동 생성)
     * GET /api/users/me/ai-recommendations/enhanced
     */
    @GetMapping("/enhanced")
    public ResponseEntity<?> getRecommendationsEnhanced(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String lang) {
        try {
            String userId = extractUserId(token);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            AIRecommendationCache cache = aiRecommendationService.getRecommendations(userId, lang);
            AIRecommendationResponse response = AIRecommendationResponse.fromCache(cache);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to get AI recommendations", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * AI 추천 재생성
     * POST /api/users/me/ai-recommendations/regenerate
     */
    @PostMapping("/regenerate")
    public ResponseEntity<?> regenerateRecommendations(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String lang) {
        try {
            String userId = extractUserId(token);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            logger.info("Regenerating AI recommendations for user: {}", userId);
            AIRecommendationCache cache = aiRecommendationService.regenerateRecommendations(userId, lang);
            AIRecommendationResponse response = AIRecommendationResponse.fromCache(cache);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Recommendations regenerated successfully");
            result.put("data", response);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to regenerate AI recommendations", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    /**
     * 추천 피드백 기록 (like/dislike/dismiss)
     * POST /api/users/me/ai-recommendations/{isbn}/feedback
     */
    @PostMapping("/{isbn}/feedback")
    public ResponseEntity<?> recordFeedback(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn,
            @Valid @RequestBody FeedbackRequest request) {
        try {
            String userId = extractUserId(token);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            logger.info("Recording feedback for user {} on isbn {}: {}", userId, isbn, request.getFeedbackType());
            AIRecommendationFeedback feedback = aiRecommendationService.recordFeedback(
                userId, isbn, request.getFeedbackType(), request.getReason());

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("feedbackType", feedback.getFeedbackType());
            result.put("recordedAt", feedback.getCreatedAt());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to record feedback", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    /**
     * 추천 클릭 이벤트 기록 (view/create_room/bookmark)
     * POST /api/users/me/ai-recommendations/{isbn}/click
     */
    @PostMapping("/{isbn}/click")
    public ResponseEntity<?> recordClick(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn,
            @Valid @RequestBody ClickRequest request) {
        try {
            String userId = extractUserId(token);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            AIRecommendationClick click = aiRecommendationService.recordClick(
                userId, isbn, request.getActionType());

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("actionType", click.getActionType());
            result.put("recordedAt", click.getCreatedAt());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to record click", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    /**
     * 추천 통계 조회 (관리/디버깅용)
     * GET /api/users/me/ai-recommendations/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader("Authorization") String token) {
        try {
            String userId = extractUserId(token);
            if (userId == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }

            // 간단한 통계 반환
            Map<String, Object> stats = new HashMap<>();
            stats.put("userId", userId);
            // 추후 상세 통계 추가 가능
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ========== Helper Methods ==========

    private String extractUserId(String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            return userOpt.map(User::getId).orElse(null);
        } catch (Exception e) {
            logger.error("Failed to extract user ID from token", e);
            return null;
        }
    }
}
