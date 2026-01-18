package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 미팅 종료 WebSocket 메시지 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MeetingEndedMessage {
    private String postId;
    private LocalDateTime endedAt;
    private String endedBy;
}
