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
    private String username;
    private String uid;
    private long timestamp;
}
