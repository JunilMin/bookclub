// backend/src/main/java/com/bookclub/backend/session/dto/JoinSessionResponse.java
package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JoinSessionResponse {
    private String sessionId;
    private String meetLink;
}
