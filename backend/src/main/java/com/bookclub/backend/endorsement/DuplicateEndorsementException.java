// ./endorsement/DuplicateEndorsementException.java
package com.bookclub.backend.endorsement;

/**
 * Exception thrown when attempting to submit a duplicate endorsement.
 * This occurs when a user tries to endorse the same target user
 * in the same session more than once.
 */
public class DuplicateEndorsementException extends RuntimeException {

    public DuplicateEndorsementException(String message) {
        super(message);
    }

    public DuplicateEndorsementException(String evaluatorUserId, String targetUserId, String sessionId) {
        super(String.format(
            "User %s has already endorsed user %s in session %s",
            evaluatorUserId, targetUserId, sessionId
        ));
    }
}
