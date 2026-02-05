package com.bookclub.backend.recommendation.repository;

import com.bookclub.backend.recommendation.model.AIRecommendationRun;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIRecommendationRunRepository extends MongoRepository<AIRecommendationRun, String> {

    List<AIRecommendationRun> findByUserIdOrderByStartedAtDesc(String userId, Pageable pageable);

    List<AIRecommendationRun> findByUserIdAndStatus(String userId, String status);
}
