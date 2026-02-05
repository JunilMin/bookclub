package com.bookclub.backend.recommendation.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * AI 추천 클릭 로그 - 암시적 피드백 (view, create_room, bookmark, search)
 */
@Document(collection = "ai_recommendation_clicks")
@CompoundIndexes({
    @CompoundIndex(name = "user_created_idx", def = "{'userId': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "isbn_created_idx", def = "{'isbn': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
public class AIRecommendationClick {

    @Id
    private String id;

    private String userId;

    private String isbn;

    private String actionType; // "view", "create_room", "bookmark", "search"

    private LocalDateTime createdAt;

    private Map<String, Object> metadata = new HashMap<>(); // 추가 컨텍스트

    // ========== Factory Method ==========

    public static AIRecommendationClick create(String userId, String isbn, String actionType, Map<String, Object> metadata) {
        AIRecommendationClick click = new AIRecommendationClick();
        click.setUserId(userId);
        click.setIsbn(isbn);
        click.setActionType(actionType);
        click.setMetadata(metadata != null ? metadata : new HashMap<>());
        click.setCreatedAt(LocalDateTime.now());
        return click;
    }
}
