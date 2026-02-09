package com.bookclub.backend.review;

import com.bookclub.backend.session.dto.ErrorResponse;
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

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reviews")
@CrossOrigin(origins = "http://localhost:5173")
public class UserReviewController {

    @Autowired
    private UserReviewService userReviewService;

    @Autowired
    private UserRepository userRepository;

    /**
     * 평균 평점 조회 (공개 API)
     * GET /api/reviews/average-rating
     */
    @GetMapping("/average-rating")
    public ResponseEntity<?> getAverageRating() {
        try {
            double avg = userReviewService.getAverageRating();
            return ResponseEntity.ok(Map.of("averageRating", Math.round(avg * 10.0) / 10.0));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 리뷰 모달 표시 여부 확인
     * GET /api/reviews/check
     */
    @GetMapping("/check")
    public ResponseEntity<?> checkReviewNeeded(HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            boolean shouldShow = userReviewService.shouldShowReview(userId);
            return ResponseEntity.ok(Map.of("shouldShow", shouldShow));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 리뷰 제출
     * POST /api/reviews
     */
    @PostMapping
    public ResponseEntity<?> submitReview(
            @RequestBody Map<String, Object> body,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            Integer rating = body.get("rating") != null ? ((Number) body.get("rating")).intValue() : null;
            String goodPoints = (String) body.get("goodPoints");
            String badPoints = (String) body.get("badPoints");
            Boolean consentToExpose = (Boolean) body.get("consentToExpose");

            if (rating == null || rating < 1 || rating > 5) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Rating must be between 1 and 5", "BAD_REQUEST"));
            }

            UserReview review = userReviewService.submitReview(userId, rating, goodPoints, badPoints, consentToExpose);
            return ResponseEntity.ok(Map.of("success", true, "reviewId", review.getId()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error: " + e.getMessage(), "SERVER_ERROR"));
        }
    }

    /**
     * 리뷰 건너뛰기
     * POST /api/reviews/skip
     */
    @PostMapping("/skip")
    public ResponseEntity<?> skipReview(HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Authentication required", "UNAUTHORIZED"));
            }

            userReviewService.skipReview(userId);
            return ResponseEntity.ok(Map.of("success", true));

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
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            Optional<User> userOpt = userRepository.findByUid(uid);
            return userOpt.map(User::getId).orElse(null);

        } catch (FirebaseAuthException e) {
            return null;
        }
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader;
        }

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
