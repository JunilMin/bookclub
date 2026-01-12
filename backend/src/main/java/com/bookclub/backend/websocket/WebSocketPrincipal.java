package com.bookclub.backend.websocket;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class WebSocketPrincipal implements Principal {
    private final String uid;
    private final String email;

    @Override
    public String getName() {
        return uid;
    }
}
