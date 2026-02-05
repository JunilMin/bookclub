package com.bookclub.backend.recommendation.repository;

import com.bookclub.backend.recommendation.model.AIRecommendationFeedback;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIRecommendationFeedbackRepository extends MongoRepository<AIRecommendationFeedback, String> {

    Optional<AIRecommendationFeedback> findByUserIdAndIsbn(String userId, String isbn);

    List<AIRecommendationFeedback> findByUserId(String userId);

    List<AIRecommendationFeedback> findByUserIdAndFeedbackType(String userId, String feedbackType);
}
