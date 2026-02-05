package com.bookclub.backend.recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 추천 클릭 이벤트 요청 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClickRequest {

    @NotBlank(message = "actionType is required")
    @Pattern(regexp = "^(view|create_room|bookmark|share)$",
             message = "actionType must be: view, create_room, bookmark, or share")
    private String actionType;  // "view", "create_room", "bookmark", "share"
}
