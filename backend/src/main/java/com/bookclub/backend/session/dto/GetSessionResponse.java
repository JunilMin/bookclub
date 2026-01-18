// backend/src/main/java/com/bookclub/backend/session/dto/GetSessionResponse.java
package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

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
        private EndInfo end;
        private List<String> blockedIds;

        // Constructor without end and blockedIds for backward compatibility
        public PostInfo(String id, String book, String isbn, LocalDateTime due,
                       String level, int capacity, int memberCount, String createrId) {
            this.id = id;
            this.book = book;
            this.isbn = isbn;
            this.due = due;
            this.level = level;
            this.capacity = capacity;
            this.memberCount = memberCount;
            this.createrId = createrId;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EndInfo {
        private boolean ended;
        private LocalDateTime endedAt;
        private String endedBy;
    }
}
