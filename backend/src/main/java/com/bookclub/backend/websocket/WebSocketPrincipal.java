package com.bookclub.backend.websocket;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class WebSocketPrincipal implements Principal {
    private final String userId;  // MongoDB ObjectId
    private final String uid;      // Firebase UID
    private final String email;

    @Override
    public String getName() {
        return userId;  // Return MongoDB ObjectId as principal name
    }
}
