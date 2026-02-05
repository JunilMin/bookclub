package com.bookclub.backend.recommendation.repository;

import com.bookclub.backend.recommendation.model.AIRecommendationCache;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AIRecommendationCacheRepository extends MongoRepository<AIRecommendationCache, String> {

    Optional<AIRecommendationCache> findByUserIdAndStatus(String userId, String status);

    void deleteByUserIdAndStatus(String userId, String status);

    Optional<AIRecommendationCache> findFirstByUserIdOrderByGeneratedAtDesc(String userId);
}
