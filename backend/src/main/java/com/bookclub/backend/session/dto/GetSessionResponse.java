// backend/src/main/java/com/bookclub/backend/session/dto/GetSessionResponse.java
package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GetSessionResponse {
    private String sessionId;
    private String status;
    private String meetLink;
    private PostInfo post;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PostInfo {
        private String id;
        private String book;
        private String isbn;
        private LocalDateTime due;
        private String level;
        private int capacity;
        private int memberCount;
        private String createrId;
    }
}
