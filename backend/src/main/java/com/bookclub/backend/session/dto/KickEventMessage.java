package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 강퇴 이벤트 메시지 - WebSocket으로 전송
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KickEventMessage {
    private String kickedUserId;     // 강퇴당한 유저 ID
    private String kickedUsername;   // 강퇴당한 유저 이름
    private String reason;           // 강퇴 사유 (선택)
}
