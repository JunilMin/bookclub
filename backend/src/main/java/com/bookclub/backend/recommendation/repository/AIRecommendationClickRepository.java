package com.bookclub.backend.recommendation.repository;

import com.bookclub.backend.recommendation.model.AIRecommendationClick;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIRecommendationClickRepository extends MongoRepository<AIRecommendationClick, String> {

    List<AIRecommendationClick> findByUserIdOrderByCreatedAtDesc(String userId);

    List<AIRecommendationClick> findByIsbnOrderByCreatedAtDesc(String isbn);

    List<AIRecommendationClick> findByUserIdAndActionType(String userId, String actionType);
}
