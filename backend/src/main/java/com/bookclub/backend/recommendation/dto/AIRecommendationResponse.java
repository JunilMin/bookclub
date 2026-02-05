package com.bookclub.backend.recommendation.dto;

import com.bookclub.backend.recommendation.model.AIRecommendationCache;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI 추천 응답 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIRecommendationResponse {

    private String status;  // "success", "regenerating", "no_data"
    private LocalDateTime generatedAt;
    private LocalDateTime expiresAt;
    private int totalCount;
    private List<RecommendedBookDTO> recommendations;

    // 추천 생성 컨텍스트 (디버깅/투명성용)
    private GenerationInfo generationInfo;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedBookDTO {
        private String isbn;
        private String title;
        private String author;
        private String coverUrl;
        private String genre;
        private String reason;
        private Double score;
        private LocalDateTime recommendedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GenerationInfo {
        private int seedCount;
        private int candidatesSearched;
        private int candidatesFiltered;
        private String selectionMethod;  // "diversity", "top_score"
    }

    /**
     * AIRecommendationCache에서 Response 생성
     */
    public static AIRecommendationResponse fromCache(AIRecommendationCache cache) {
        if (cache == null) {
            return AIRecommendationResponse.builder()
                .status("no_data")
                .totalCount(0)
                .recommendations(List.of())
                .build();
        }

        List<RecommendedBookDTO> books = cache.getItems().stream()
            .map(item -> RecommendedBookDTO.builder()
                .isbn(item.getIsbn())
                .title(item.getTitle())
                .author(item.getAuthor())
                .coverUrl(item.getCoverUrl())
                .genre(item.getGenre())
                .reason(item.getReason())
                .score(item.getScore())
                .recommendedAt(item.getAddedAt())
                .build())
            .toList();

        GenerationInfo info = null;
        if (cache.getContext() != null) {
            info = GenerationInfo.builder()
                .seedCount(cache.getContext().getSeedIsbns() != null ?
                    cache.getContext().getSeedIsbns().size() : 0)
                .candidatesSearched(cache.getContext().getCandidatesSearched())
                .candidatesFiltered(cache.getContext().getCandidatesAfterFilter())
                .selectionMethod("diversity")
                .build();
        }

        return AIRecommendationResponse.builder()
            .status(cache.getStatus())
            .generatedAt(cache.getGeneratedAt())
            .expiresAt(cache.getExpiresAt())
            .totalCount(books.size())
            .recommendations(books)
            .generationInfo(info)
            .build();
    }
}
