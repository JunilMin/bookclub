package com.bookclub.backend.session.repository;

/**
 * Custom repository interface for atomic operations on SessionRecording
 */
public interface SessionRecordingRepositoryCustom {

    /**
     * Atomically increment the utterance count and return the new value.
     * This ensures no race conditions when multiple utterances are processed simultaneously.
     *
     * @param sessionId The session ID
     * @return The new utterance index (after increment)
     */
    int incrementAndGetUtteranceCount(String sessionId);
}
