package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NoteUpdateMessage {
    private String content;
    private String userId;      // User ObjectId (used for DB)
    private String username;    // Username (used for display)
    private String uid;         // Firebase UID
    private long timestamp;
}
