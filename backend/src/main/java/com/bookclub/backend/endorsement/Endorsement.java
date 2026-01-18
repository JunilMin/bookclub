// ./endorsement/Endorsement.java
package com.bookclub.backend.endorsement;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document representing an endorsement from one user to another.
 * Each endorsement records which positive categories the evaluator selected
 * for the target user after a meeting session.
 *
 * Unique constraint: One user can only endorse another user once per session.
 */
@Document(collection = "endorsements")
@CompoundIndex(
    name = "unique_endorsement",
    def = "{'sessionId': 1, 'evaluatorUserId': 1, 'targetUserId': 1}",
    unique = true
)
@Getter
@Setter
@NoArgsConstructor
public class Endorsement {

    @Id
    private String id;

    private String sessionId;           // Session where endorsement was given
    private String postId;              // Post associated with the session (denormalized)
    private String evaluatorUserId;     // User giving the endorsement
    private String targetUserId;        // User receiving the endorsement

    private List<String> selected;      // List of selected category codes (can be empty)
    private int points;                 // Total points (= selected.size())

    private LocalDateTime createdAt;

    /**
     * Create a new endorsement.
     *
     * @param sessionId The session ID
     * @param postId The post ID
     * @param evaluatorUserId The user giving the endorsement
     * @param targetUserId The user receiving the endorsement
     * @param selected List of selected category codes (can be empty for neutral endorsement)
     */
    public Endorsement(String sessionId, String postId,
                       String evaluatorUserId, String targetUserId,
                       List<String> selected) {
        this.sessionId = sessionId;
        this.postId = postId;
        this.evaluatorUserId = evaluatorUserId;
        this.targetUserId = targetUserId;
        this.selected = selected != null ? new ArrayList<>(selected) : new ArrayList<>();
        this.points = this.selected.size();  // Each category = 1 point
        this.createdAt = LocalDateTime.now();
    }
}
