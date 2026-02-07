package com.bookclub.backend.post.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 미팅 종료 API 응답 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EndPostResponse {
    private String postId;
    private boolean ended;
    private LocalDateTime endedAt;
    private String endedBy;

    public static EndPostResponse from(String postId, boolean ended, LocalDateTime endedAt, String endedBy) {
        return new EndPostResponse(postId, ended, endedAt, endedBy);
    }
}
