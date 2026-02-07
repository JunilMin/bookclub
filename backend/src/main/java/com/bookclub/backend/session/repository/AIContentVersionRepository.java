package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.AIContentVersion;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIContentVersionRepository extends MongoRepository<AIContentVersion, String> {

    /**
     * Find all versions for a session, ordered by version descending (newest first)
     */
    List<AIContentVersion> findBySessionIdOrderByVersionDesc(String sessionId);

    /**
     * Find all versions for a session, ordered by version ascending (oldest first)
     */
    List<AIContentVersion> findBySessionIdOrderByVersionAsc(String sessionId);

    /**
     * Find a specific version by sessionId and version number
     */
    Optional<AIContentVersion> findBySessionIdAndVersion(String sessionId, int version);

    /**
     * Find the latest version for a session
     */
    Optional<AIContentVersion> findFirstBySessionIdOrderByVersionDesc(String sessionId);

    /**
     * Count total versions for a session
     */
    long countBySessionId(String sessionId);

    /**
     * Delete versions older than a specific version number
     */
    void deleteBySessionIdAndVersionLessThan(String sessionId, int version);

    /**
     * Delete all versions for a session
     */
    void deleteBySessionId(String sessionId);

    /**
     * Check if a specific version exists
     */
    boolean existsBySessionIdAndVersion(String sessionId, int version);
}
