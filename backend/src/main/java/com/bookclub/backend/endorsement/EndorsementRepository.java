// ./endorsement/EndorsementRepository.java
package com.bookclub.backend.endorsement;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MongoDB repository for endorsement operations.
 */
@Repository
public interface EndorsementRepository extends MongoRepository<Endorsement, String> {

    /**
     * Check if an endorsement already exists.
     * Used to prevent duplicate endorsements.
     */
    boolean existsBySessionIdAndEvaluatorUserIdAndTargetUserId(
        String sessionId, String evaluatorUserId, String targetUserId);

    /**
     * Get all endorsements given by a user in a session.
     * Used to determine which participants have already been endorsed.
     */
    List<Endorsement> findBySessionIdAndEvaluatorUserId(
        String sessionId, String evaluatorUserId);

    /**
     * Get all endorsements received by a user.
     * Used for displaying user's endorsement history.
     */
    List<Endorsement> findByTargetUserId(String targetUserId);

    /**
     * Get all endorsements in a session.
     */
    List<Endorsement> findBySessionId(String sessionId);

    /**
     * Get only the target user IDs that an evaluator has already endorsed in a session.
     * Optimized query that returns only the targetUserId field.
     */
    @Query(value = "{'sessionId': ?0, 'evaluatorUserId': ?1}",
           fields = "{'targetUserId': 1, '_id': 0}")
    List<Endorsement> findTargetUserIdsBySessionIdAndEvaluatorUserId(
        String sessionId, String evaluatorUserId);
}
