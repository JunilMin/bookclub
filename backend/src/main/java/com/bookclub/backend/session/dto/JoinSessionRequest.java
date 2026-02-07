// backend/src/main/java/com/bookclub/backend/session/dto/JoinSessionRequest.java
package com.bookclub.backend.session.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class JoinSessionRequest {
    private String postId;
}
