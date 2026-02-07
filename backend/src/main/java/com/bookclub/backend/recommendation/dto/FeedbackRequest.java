package com.bookclub.backend.recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 추천 피드백 요청 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackRequest {

    @NotBlank(message = "feedbackType is required")
    @Pattern(regexp = "^(like|dislike|dismiss)$", message = "feedbackType must be: like, dislike, or dismiss")
    private String feedbackType;  // "like", "dislike", "dismiss"

    private String reason;  // 선택적 사유 (dislike 시 유용)
}
