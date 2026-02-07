package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SessionUtterance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionUtteranceRepository extends MongoRepository<SessionUtterance, String> {

    /**
     * Find all utterances for a session, ordered by utterance index (ascending)
     */
    List<SessionUtterance> findBySessionIdOrderByUtteranceIndexAsc(String sessionId);

    /**
     * Find a specific utterance by session and index
     */
    Optional<SessionUtterance> findBySessionIdAndUtteranceIndex(String sessionId, int utteranceIndex);

    /**
     * Count total utterances in a session
     */
    int countBySessionId(String sessionId);

    /**
     * Delete all utterances for a session
     */
    void deleteBySessionId(String sessionId);

    /**
     * Find all utterances by a specific speaker
     */
    List<SessionUtterance> findBySpeakerIdOrderByCreatedAtDesc(String speakerId);

    /**
     * Find utterances not yet inserted to notes for a session
     */
    List<SessionUtterance> findBySessionIdAndInsertedToNotesFalseOrderByUtteranceIndexAsc(String sessionId);
}
