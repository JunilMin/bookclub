package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SessionNote;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionNoteRepository extends MongoRepository<SessionNote, String> {
    /**
     * Find a single note by sessionId.
     * Note: Use findAllBySessionId if duplicates might exist in the database.
     */
    Optional<SessionNote> findBySessionId(String sessionId);

    /**
     * Find all notes by sessionId (handles potential duplicates).
     * Returns results ordered by createdAt descending (most recent first).
     */
    List<SessionNote> findAllBySessionIdOrderByCreatedAtDesc(String sessionId);

    /**
     * Find the first note by sessionId (safely handles duplicates).
     */
    Optional<SessionNote> findFirstBySessionIdOrderByCreatedAtDesc(String sessionId);
}
