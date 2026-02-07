// ./endorsement/dto/EndorsementResponse.java
package com.bookclub.backend.endorsement.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for endorsement API responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EndorsementResponse {

    private String id;                  // Endorsement ID
    private String sessionId;
    private String targetUserId;
    private String targetUsername;
    private List<String> selected;      // Selected categories
    private int points;                 // Points added
    private LocalDateTime createdAt;

    /**
     * Participant info for pending endorsements list.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingParticipant {
        private String userId;
        private String username;
        private String photoUrl;
        private boolean alreadyEndorsed;    // True if current user already endorsed this participant
    }

    /**
     * Response for getting pending participants to endorse.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingResponse {
        private String sessionId;
        private List<PendingParticipant> participants;
    }
}
