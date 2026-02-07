// ./endorsement/dto/EndorsementRequest.java
package com.bookclub.backend.endorsement.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Request DTO for submitting an endorsement.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EndorsementRequest {

    private String sessionId;           // Session ID where endorsement is submitted
    private String targetUserId;        // User being endorsed

    /**
     * List of selected category codes.
     * Can be empty for neutral endorsement (no penalty, just marks as "reviewed").
     * Valid values: ENGAGEMENT, COMMUNICATION, RESPECT, RULE_ADHERENCE, PREPARATION, REMATCH
     */
    private List<String> selected;
}
