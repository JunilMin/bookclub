package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PresenceMessage {
    private String action;  // "JOIN", "LEAVE", "CURSOR_MOVE"
    private String odUserId;
    private String username;
    private String photoUrl;
    private CursorPosition cursorPosition;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CursorPosition {
        private int from;
        private int to;
        private String color;
    }
}
