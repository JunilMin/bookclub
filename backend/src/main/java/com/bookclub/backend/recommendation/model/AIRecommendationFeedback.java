package com.bookclub.backend.recommendation.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * AI 추천 피드백 - 사용자의 명시적 피드백 (like/dislike/dismiss)
 */
@Document(collection = "ai_recommendation_feedback")
@CompoundIndexes({
    @CompoundIndex(name = "user_isbn_idx", def = "{'userId': 1, 'isbn': 1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
public class AIRecommendationFeedback {

    @Id
    private String id;

    private String userId;

    private String isbn;

    private String feedbackType; // "like", "dislike", "dismiss"

    private String reason; // 사용자가 입력한 이유 (선택)

    private LocalDateTime createdAt;

    private String recommendationRunId; // 어떤 run에서 생성된 추천인지

    // ========== Factory Method ==========

    public static AIRecommendationFeedback create(String userId, String isbn, String feedbackType, String reason, String runId) {
        AIRecommendationFeedback feedback = new AIRecommendationFeedback();
        feedback.setUserId(userId);
        feedback.setIsbn(isbn);
        feedback.setFeedbackType(feedbackType);
        feedback.setReason(reason);
        feedback.setRecommendationRunId(runId);
        feedback.setCreatedAt(LocalDateTime.now());
        return feedback;
    }
}
