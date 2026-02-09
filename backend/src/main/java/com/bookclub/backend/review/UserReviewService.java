package com.bookclub.backend.review;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserReviewService {

    @Autowired
    private UserReviewRepository userReviewRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private UserRepository userRepository;

    /**
     * 리뷰 모달을 보여줘야 하는지 확인
     */
    public boolean shouldShowReview(String userId) {
        // 1. 유저의 토론 이력 확인 (created 또는 participated)
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return false;

        User user = userOpt.get();
        List<String> created = user.getPosts().getCreated();
        List<String> participated = user.getPosts().getParticipated();
        boolean hasHistory = (created != null && !created.isEmpty())
                          || (participated != null && !participated.isEmpty());
        if (!hasHistory) return false;

        // 2. 기존 리뷰 확인
        Optional<UserReview> reviewOpt = userReviewRepository.findByUserId(userId);

        if (reviewOpt.isEmpty()) {
            // 리뷰가 없으면 → 보여줘야 함
            return true;
        }

        UserReview review = reviewOpt.get();

        // 제출 완료된 리뷰 → 다시 안 보여줌
        if (review.getSubmittedAt() != null) {
            return false;
        }

        // 건너뛴 적이 없으면 → 보여줘야 함
        if (review.getSkippedAt() == null) {
            return true;
        }

        // 건너뛴 리뷰 → 3일 경과 시 재노출
        return review.getSkippedAt().plusDays(3).isBefore(LocalDateTime.now());
    }

    /**
     * 리뷰 제출
     */
    public UserReview submitReview(String userId, Integer rating, String goodPoints,
                                    String badPoints, Boolean consentToExpose) {
        Optional<UserReview> existing = userReviewRepository.findByUserId(userId);

        UserReview review;
        if (existing.isPresent()) {
            review = existing.get();
        } else {
            review = new UserReview();
            review.setUserId(userId);
            review.setCreatedAt(LocalDateTime.now());
        }

        review.setRating(rating);
        review.setGoodPoints(goodPoints);
        review.setBadPoints(badPoints);
        review.setConsentToExpose(consentToExpose);
        review.setSubmittedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());

        return userReviewRepository.save(review);
    }

    /**
     * 리뷰 건너뛰기
     */
    public UserReview skipReview(String userId) {
        Optional<UserReview> existing = userReviewRepository.findByUserId(userId);

        UserReview review;
        if (existing.isPresent()) {
            review = existing.get();
        } else {
            review = new UserReview();
            review.setUserId(userId);
            review.setCreatedAt(LocalDateTime.now());
        }

        review.setSkippedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());

        return userReviewRepository.save(review);
    }

    /**
     * 제출된 리뷰의 평균 평점 조회
     */
    @SuppressWarnings("unchecked")
    public double getAverageRating() {
        Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.match(Criteria.where("rating").ne(null).and("submittedAt").ne(null)),
            Aggregation.group().avg("rating").as("avg")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(
            aggregation, "user_review", Map.class
        );

        Map result = results.getUniqueMappedResult();
        if (result == null || result.get("avg") == null) {
            return 0.0;
        }
        return ((Number) result.get("avg")).doubleValue();
    }
}
