package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class QueueActionMessage {
    private String action;  // "RAISE_HAND", "NEXT_SPEAKER", "REMOVE"
    private String odUserId;
    private String username;
    private String photoUrl;
}
