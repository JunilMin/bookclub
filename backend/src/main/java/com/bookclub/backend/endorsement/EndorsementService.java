// ./endorsement/EndorsementService.java
package com.bookclub.backend.endorsement;

import com.bookclub.backend.endorsement.dto.EndorsementRequest;
import com.bookclub.backend.endorsement.dto.EndorsementResponse;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for handling endorsement operations.
 */
@Service
public class EndorsementService {

    @Autowired
    private EndorsementRepository endorsementRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Submit an endorsement for a participant.
     * Validates permissions and prevents duplicates.
     *
     * @param evaluatorUserId The user giving the endorsement (from Firebase token)
     * @param request The endorsement request
     * @return The created endorsement response
     */
    @Transactional
    public EndorsementResponse submitEndorsement(String evaluatorUserId, EndorsementRequest request) {
        // 1. Validate session exists
        Session session = sessionRepository.findById(request.getSessionId())
            .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        // 2. Validate post exists
        Post post = postRepository.findById(session.getPostId())
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        // 3. Validate evaluator is a participant
        boolean evaluatorIsParticipant = isParticipant(post, evaluatorUserId);
        if (!evaluatorIsParticipant) {
            throw new IllegalArgumentException("Evaluator is not a participant of this meeting");
        }

        // 4. Validate target is a participant and not self
        String targetUserId = request.getTargetUserId();
        if (evaluatorUserId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot endorse yourself");
        }

        boolean targetIsParticipant = isParticipant(post, targetUserId);
        if (!targetIsParticipant) {
            throw new IllegalArgumentException("Target is not a participant of this meeting");
        }

        // 5. Validate and filter categories (allow empty selection)
        List<String> validCategories = new ArrayList<>();
        if (request.getSelected() != null) {
            validCategories = request.getSelected().stream()
                .filter(EndorsementCategory::isValid)
                .distinct()
                .collect(Collectors.toList());
        }

        // 6. Create endorsement
        Endorsement endorsement = new Endorsement(
            request.getSessionId(),
            session.getPostId(),
            evaluatorUserId,
            targetUserId,
            validCategories
        );

        // 7. Save endorsement (unique index will catch duplicates)
        try {
            endorsement = endorsementRepository.save(endorsement);
        } catch (DuplicateKeyException e) {
            throw new DuplicateEndorsementException(
                "You have already submitted feedback for this user in this session."
            );
        }

        // 8. Update target user's endorsement stats
        updateUserEndorsementStats(targetUserId, validCategories);

        // 9. Get target username for response
        String targetUsername = "Unknown";
        try {
            User targetUser = userRepository.findById(new ObjectId(targetUserId)).orElse(null);
            if (targetUser != null) {
                targetUsername = targetUser.getUsername();
            }
        } catch (IllegalArgumentException e) {
            // Invalid ObjectId format, use default username
        }

        return new EndorsementResponse(
            endorsement.getId(),
            endorsement.getSessionId(),
            endorsement.getTargetUserId(),
            targetUsername,
            endorsement.getSelected(),
            endorsement.getPoints(),
            endorsement.getCreatedAt()
        );
    }

    /**
     * Get pending participants for endorsement in a session.
     * Returns all participants except the evaluator, with endorsement status.
     *
     * @param sessionId The session ID
     * @param evaluatorUserId The current user's ID
     * @return Response containing list of participants with endorsement status
     */
    public EndorsementResponse.PendingResponse getPendingParticipants(
            String sessionId, String evaluatorUserId) {

        // 1. Get session
        Session session = sessionRepository.findById(sessionId)
            .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        // 2. Get post
        Post post = postRepository.findById(session.getPostId())
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        // 3. Get all participant IDs (creator + members, excluding evaluator)
        List<String> participantIds = new ArrayList<>();
        if (post.getCreaterId() != null) {
            participantIds.add(post.getCreaterId());
        }
        if (post.getMemberIds() != null) {
            participantIds.addAll(post.getMemberIds());
        }
        participantIds = participantIds.stream()
            .filter(id -> !id.equals(evaluatorUserId))
            .distinct()
            .collect(Collectors.toList());

        // 4. Get already endorsed target IDs
        List<String> alreadyEndorsedIds = endorsementRepository
            .findBySessionIdAndEvaluatorUserId(sessionId, evaluatorUserId)
            .stream()
            .map(Endorsement::getTargetUserId)
            .collect(Collectors.toList());

        // 5. Build participant list with endorsement status
        List<EndorsementResponse.PendingParticipant> participants = participantIds.stream()
            .map(userId -> {
                User user = null;
                try {
                    user = userRepository.findById(new ObjectId(userId)).orElse(null);
                } catch (IllegalArgumentException e) {
                    // Invalid ObjectId format
                }
                return new EndorsementResponse.PendingParticipant(
                    userId,
                    user != null ? user.getUsername() : "Unknown",
                    user != null ? user.getPhotoUrl() : null,
                    alreadyEndorsedIds.contains(userId)
                );
            })
            .collect(Collectors.toList());

        return new EndorsementResponse.PendingResponse(sessionId, participants);
    }

    /**
     * Check if a specific endorsement already exists.
     *
     * @param sessionId The session ID
     * @param evaluatorUserId The evaluator user ID
     * @param targetUserId The target user ID
     * @return True if endorsement exists
     */
    public boolean endorsementExists(String sessionId, String evaluatorUserId, String targetUserId) {
        return endorsementRepository.existsBySessionIdAndEvaluatorUserIdAndTargetUserId(
            sessionId, evaluatorUserId, targetUserId
        );
    }

    /**
     * Check if a user is a participant of the meeting.
     */
    private boolean isParticipant(Post post, String userId) {
        boolean isCreator = post.getCreaterId() != null && post.getCreaterId().equals(userId);
        boolean isMember = post.getMemberIds() != null && post.getMemberIds().contains(userId);
        return isCreator || isMember;
    }

    /**
     * Update user's endorsement statistics.
     *
     * @param userId The user ID to update
     * @param categories The selected categories
     */
    private void updateUserEndorsementStats(String userId, List<String> categories) {
        User user = userRepository.findById(new ObjectId(userId))
            .orElseThrow(() -> new IllegalArgumentException("Target user not found"));

        User.EndorsementStats stats = user.getEndorsementStats();
        if (stats == null) {
            stats = new User.EndorsementStats(0);
            user.setEndorsementStats(stats);
        }

        // Increment total count (even for empty selection)
        stats.incrementCount();

        // Add points based on selected categories
        int pointsToAdd = categories.size();
        stats.addPoints(pointsToAdd);

        // Increment per-category counts
        for (String category : categories) {
            stats.incrementCategory(category);
        }

        userRepository.save(user);
    }
}
