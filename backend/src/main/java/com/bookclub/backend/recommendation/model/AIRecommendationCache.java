package com.bookclub.backend.recommendation.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * AI 추천 캐시 - 사용자별 현재 활성 추천 목록 저장
 */
@Document(collection = "ai_recommendations")
@CompoundIndexes({
    @CompoundIndex(name = "user_status_idx", def = "{'userId': 1, 'status': 1}")
})
@Getter
@Setter
@NoArgsConstructor
public class AIRecommendationCache {

    @Id
    private String id;

    private String userId;

    private LocalDateTime generatedAt;

    private LocalDateTime expiresAt;

    private String status; // "active", "expired", "regenerating"

    private GenerationContext context;

    private List<RecommendedBook> items = new ArrayList<>();

    private int version; // optimistic locking

    // ========== Inner Classes ==========

    @Getter
    @Setter
    @NoArgsConstructor
    public static class GenerationContext {
        private List<String> seedIsbns = new ArrayList<>();
        private List<String> excludedIsbns = new ArrayList<>();
        private String preferredLanguage; // "ko" or "en"
        private List<String> preferredGenres = new ArrayList<>();
        private int candidatesSearched;
        private int candidatesAfterFilter;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class RecommendedBook {
        private String isbn;
        private String title;
        private String author;
        private String coverUrl;
        private String reason; // LLM 생성 추천 이유
        private double score; // 0-100 점수
        private ScoreBreakdown scoreBreakdown;
        private String genre;
        private String language; // "en" or "ko"
        private LocalDateTime addedAt;
        private String feedbackStatus; // null, "liked", "disliked", "dismissed"

        public RecommendedBook(String isbn, String title, String author, String reason) {
            this.isbn = isbn;
            this.title = title;
            this.author = author;
            this.reason = reason;
            this.addedAt = LocalDateTime.now();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class ScoreBreakdown {
        private double genreScore;      // 0-40
        private double authorScore;     // 0-20
        private double keywordScore;    // 0-15
        private double popularityScore; // 0-15
        private double diversityPenalty; // 0 to -20

        public double getTotal() {
            return genreScore + authorScore + keywordScore + popularityScore + diversityPenalty;
        }
    }

    // ========== Factory Methods ==========

    public static AIRecommendationCache create(String userId, List<RecommendedBook> items, GenerationContext context) {
        AIRecommendationCache cache = new AIRecommendationCache();
        cache.setUserId(userId);
        cache.setItems(items);
        cache.setContext(context);
        cache.setGeneratedAt(LocalDateTime.now());
        cache.setExpiresAt(LocalDateTime.now().plusDays(7));
        cache.setStatus("active");
        cache.setVersion(1);
        return cache;
    }

    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
}
