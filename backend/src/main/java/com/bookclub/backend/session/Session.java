// backend/src/main/java/com/bookclub/backend/session/Session.java
package com.bookclub.backend.session;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "sessions")
@Getter
@Setter
@NoArgsConstructor
public class Session {

    @Id
    private String id;  // MongoDB ObjectId (= sessionId = sessionNumber)

    private String postId;  // 연결된 Post의 ID

    private String status;  // "live", "ended", "scheduled"

    private LocalDateTime createdAt;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    public Session(String postId) {
        this.postId = postId;
        this.status = "live";
        this.createdAt = LocalDateTime.now();
        this.startedAt = LocalDateTime.now();
    }
}
