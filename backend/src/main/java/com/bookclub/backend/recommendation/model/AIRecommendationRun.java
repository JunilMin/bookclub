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
 * AI 추천 생성 이력 - 추천 생성 시점/파라미터/결과 스냅샷 기록
 */
@Document(collection = "ai_recommendation_runs")
@CompoundIndexes({
    @CompoundIndex(name = "user_run_idx", def = "{'userId': 1, 'startedAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
public class AIRecommendationRun {

    @Id
    private String id;

    private String userId;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String status; // "success", "failed", "partial"

    private String triggerType; // "manual", "scheduled", "auto"

    private GenerationStats stats;

    private String errorMessage;

    // ========== Inner Classes ==========

    @Getter
    @Setter
    @NoArgsConstructor
    public static class GenerationStats {
        private int seedCount;           // seed ISBN 개수
        private int candidatesFound;     // 검색된 후보 도서
        private int candidatesAfterFilter; // 필터링 후 후보
        private int finalRecommendations; // 최종 추천 수
        private long processingTimeMs;
        private boolean usedLLM;         // GPT 사용 여부
        private String modelUsed;        // "gpt-4o-mini" or "rule-based"
    }

    // ========== Factory Methods ==========

    public static AIRecommendationRun start(String userId, String triggerType) {
        AIRecommendationRun run = new AIRecommendationRun();
        run.setUserId(userId);
        run.setTriggerType(triggerType);
        run.setStartedAt(LocalDateTime.now());
        run.setStatus("running");
        run.setStats(new GenerationStats());
        return run;
    }

    public void complete(String status) {
        this.status = status;
        this.completedAt = LocalDateTime.now();
        if (this.stats != null && this.startedAt != null) {
            this.stats.setProcessingTimeMs(
                java.time.Duration.between(startedAt, completedAt).toMillis()
            );
        }
    }

    public void fail(String errorMessage) {
        this.status = "failed";
        this.errorMessage = errorMessage;
        this.completedAt = LocalDateTime.now();
    }
}
