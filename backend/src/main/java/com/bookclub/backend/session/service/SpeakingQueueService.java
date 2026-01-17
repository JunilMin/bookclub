package com.bookclub.backend.session.service;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.model.SpeakingQueue.*;
import com.bookclub.backend.session.repository.SpeakingQueueRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class SpeakingQueueService {

    @Autowired
    private SpeakingQueueRepository speakingQueueRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    private static final int DEFAULT_SPEAKING_TIME = 180; // 3 minutes

    public SpeakingQueue getOrCreateQueue(String sessionId) {
        Optional<SpeakingQueue> queueOpt = speakingQueueRepository.findFirstBySessionId(sessionId);
        if (queueOpt.isPresent()) {
            return queueOpt.get();
        }

        // Get the creator ID from the session's post to set as initial moderator
        String moderatorId = null;
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isPresent()) {
            Optional<Post> postOpt = postRepository.findById(sessionOpt.get().getPostId());
            if (postOpt.isPresent()) {
                moderatorId = postOpt.get().getCreaterId();
            }
        }

        SpeakingQueue queue = new SpeakingQueue(sessionId, moderatorId);
        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue raiseHand(String sessionId, String userId, String username, String photoUrl) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Find participant
        SessionParticipant participant = queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElse(null);

        if (participant == null) {
            // Add as new participant
            participant = new SessionParticipant(userId, username, photoUrl, false);
            queue.getParticipants().add(participant);
        }

        // Toggle hand raised status
        participant.setHasRaisedHand(!participant.isHasRaisedHand());

        if (participant.isHasRaisedHand()) {
            // Add to queue if not already present
            boolean alreadyInQueue = queue.getQueue().stream()
                    .anyMatch(q -> q.getUserId().equals(userId));

            if (!alreadyInQueue) {
                int position = queue.getQueue().size() + 1;
                QueuedParticipant queued = new QueuedParticipant(userId, username, photoUrl, position);
                queue.getQueue().add(queued);
            }
        } else {
            // Remove from queue
            queue.getQueue().removeIf(q -> q.getUserId().equals(userId));
            // Recalculate positions
            for (int i = 0; i < queue.getQueue().size(); i++) {
                queue.getQueue().get(i).setPosition(i + 1);
            }
        }

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue nextSpeaker(String sessionId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Add previous speaker to history
        if (queue.getCurrentSpeaker() != null) {
            CurrentSpeaker prevSpeaker = queue.getCurrentSpeaker();
            LocalDateTime endTime = LocalDateTime.now();

            // Calculate speak count for this user
            long speakCount = queue.getSpeakingHistory().stream()
                    .filter(h -> h.getUserId().equals(prevSpeaker.getUserId()))
                    .count() + 1;  // +1 for current speaking session

            // Add to history
            SpeakingQueue.SpeakingHistoryEntry historyEntry = new SpeakingQueue.SpeakingHistoryEntry(
                    prevSpeaker.getUserId(),
                    prevSpeaker.getUsername(),
                    prevSpeaker.getStartedAt(),
                    endTime,
                    (int) speakCount
            );
            queue.getSpeakingHistory().add(0, historyEntry);  // Add to beginning (stack)

            // Update hand status for previous speaker
            queue.getParticipants().stream()
                    .filter(p -> p.getUserId().equals(prevSpeaker.getUserId()))
                    .findFirst()
                    .ifPresent(p -> p.setHasRaisedHand(false));
        }

        if (queue.getQueue().isEmpty()) {
            queue.setCurrentSpeaker(null);
        } else {
            QueuedParticipant next = queue.getQueue().remove(0);

            // Set new speaker
            CurrentSpeaker speaker = new CurrentSpeaker(
                    next.getUserId(),
                    next.getUsername(),
                    next.getPhotoUrl(),
                    DEFAULT_SPEAKING_TIME
            );
            queue.setCurrentSpeaker(speaker);

            // Update hand status for new speaker
            queue.getParticipants().stream()
                    .filter(p -> p.getUserId().equals(next.getUserId()))
                    .findFirst()
                    .ifPresent(p -> p.setHasRaisedHand(false));

            // Recalculate positions
            for (int i = 0; i < queue.getQueue().size(); i++) {
                queue.getQueue().get(i).setPosition(i + 1);
            }
        }

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue addParticipant(String sessionId, String userId, String username, String photoUrl, boolean isHost) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        boolean exists = queue.getParticipants().stream()
                .anyMatch(p -> p.getUserId().equals(userId));

        if (!exists) {
            SessionParticipant participant = new SessionParticipant(userId, username, photoUrl, isHost);
            queue.getParticipants().add(participant);
            System.out.println("=== NEW PARTICIPANT ADDED ===");
            System.out.println("SessionId: " + sessionId);
            System.out.println("UserId: " + userId);
            System.out.println("Username: " + username);
            System.out.println("IsOnline: " + participant.isOnline());
            System.out.println("Total participants: " + queue.getParticipants().size());
            return speakingQueueRepository.save(queue);
        }

        // Update online status and heartbeat if participant exists
        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> {
                    p.setOnline(true);
                    p.setLastHeartbeat(LocalDateTime.now());
                    System.out.println("=== PARTICIPANT REJOINED ===");
                    System.out.println("UserId: " + userId);
                    System.out.println("IsOnline: " + p.isOnline());
                });

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue removeFromQueue(String sessionId, String userId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        queue.getQueue().removeIf(q -> q.getUserId().equals(userId));

        // Update hand status
        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> p.setHasRaisedHand(false));

        // Recalculate positions
        for (int i = 0; i < queue.getQueue().size(); i++) {
            queue.getQueue().get(i).setPosition(i + 1);
        }

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue setParticipantOffline(String sessionId, String userId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Set participant offline and reset hand status
        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> {
                    p.setOnline(false);
                    p.setHasRaisedHand(false);
                });

        // Remove from speaking queue
        queue.getQueue().removeIf(q -> q.getUserId().equals(userId));

        // Recalculate positions
        for (int i = 0; i < queue.getQueue().size(); i++) {
            queue.getQueue().get(i).setPosition(i + 1);
        }

        // If current speaker went offline, move to next speaker
        if (queue.getCurrentSpeaker() != null && queue.getCurrentSpeaker().getUserId().equals(userId)) {
            // Add to history before clearing
            CurrentSpeaker prevSpeaker = queue.getCurrentSpeaker();
            LocalDateTime endTime = LocalDateTime.now();
            long speakCount = queue.getSpeakingHistory().stream()
                    .filter(h -> h.getUserId().equals(prevSpeaker.getUserId()))
                    .count() + 1;
            SpeakingQueue.SpeakingHistoryEntry historyEntry = new SpeakingQueue.SpeakingHistoryEntry(
                    prevSpeaker.getUserId(),
                    prevSpeaker.getUsername(),
                    prevSpeaker.getStartedAt(),
                    endTime,
                    (int) speakCount
            );
            queue.getSpeakingHistory().add(0, historyEntry);

            // Clear current speaker (next speaker logic can be triggered by moderator)
            queue.setCurrentSpeaker(null);
        }

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue addParticipantToQueueByHost(String sessionId, String userId, String username, String photoUrl) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Find participant
        SessionParticipant participant = queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElse(null);

        if (participant == null) {
            // Add as new participant
            participant = new SessionParticipant(userId, username, photoUrl, false);
            queue.getParticipants().add(participant);
        }

        // Set hand raised to true
        participant.setHasRaisedHand(true);

        // Add to queue if not already present
        boolean alreadyInQueue = queue.getQueue().stream()
                .anyMatch(q -> q.getUserId().equals(userId));

        if (!alreadyInQueue) {
            int position = queue.getQueue().size() + 1;
            QueuedParticipant queued = new QueuedParticipant(userId, username, photoUrl, position);
            queue.getQueue().add(queued);
        }

        return speakingQueueRepository.save(queue);
    }

    public SpeakingQueue reorderQueue(String sessionId, java.util.List<String> userIds) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Create a map of userId to QueuedParticipant for fast lookup
        java.util.Map<String, QueuedParticipant> participantMap = new java.util.HashMap<>();
        for (QueuedParticipant qp : queue.getQueue()) {
            participantMap.put(qp.getUserId(), qp);
        }

        // Build new queue in the order specified by userIds
        java.util.List<QueuedParticipant> newQueue = new java.util.ArrayList<>();
        for (int i = 0; i < userIds.size(); i++) {
            String userId = userIds.get(i);
            QueuedParticipant qp = participantMap.get(userId);
            if (qp != null) {
                qp.setPosition(i + 1);
                newQueue.add(qp);
            }
        }

        // Replace queue with reordered queue
        queue.setQueue(newQueue);

        return speakingQueueRepository.save(queue);
    }

    /**
     * Delegate moderator role to another participant
     * @param sessionId The session ID
     * @param newModeratorId The userId of the new moderator
     * @return Updated SpeakingQueue
     */
    public SpeakingQueue delegateModerator(String sessionId, String newModeratorId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        // Verify the new moderator is a participant
        boolean isParticipant = queue.getParticipants().stream()
                .anyMatch(p -> p.getUserId().equals(newModeratorId));

        if (!isParticipant) {
            throw new IllegalArgumentException("New moderator must be a participant in the session");
        }

        // Update moderatorId
        queue.setModeratorId(newModeratorId);

        return speakingQueueRepository.save(queue);
    }

    /**
     * Get the current moderator ID for a session
     */
    public String getModeratorId(String sessionId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);
        return queue.getModeratorId();
    }

    /**
     * Get the count of online participants for a session
     * @param sessionId The session ID
     * @return Number of online participants
     */
    public int getOnlineParticipantCount(String sessionId) {
        Optional<SpeakingQueue> queueOpt = speakingQueueRepository.findFirstBySessionId(sessionId);
        if (queueOpt.isEmpty()) {
            return 0;
        }

        SpeakingQueue queue = queueOpt.get();
        return (int) queue.getParticipants().stream()
                .filter(SessionParticipant::isOnline)
                .count();
    }

    /**
     * Get online participant counts for multiple sessions
     * @param sessionIds List of session IDs
     * @return Map of sessionId to online participant count
     */
    public java.util.Map<String, Integer> getOnlineParticipantCounts(java.util.List<String> sessionIds) {
        java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        for (String sessionId : sessionIds) {
            counts.put(sessionId, getOnlineParticipantCount(sessionId));
        }
        return counts;
    }

    /**
     * Update the heartbeat timestamp for a participant
     * @param sessionId The session ID
     * @param userId The user ID
     * @return Updated SpeakingQueue
     */
    public SpeakingQueue updateHeartbeat(String sessionId, String userId) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);

        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> {
                    p.setLastHeartbeat(LocalDateTime.now());
                    p.setOnline(true);  // Ensure online status is true
                });

        return speakingQueueRepository.save(queue);
    }

    /**
     * Mark participants as offline if their heartbeat is stale
     * @param sessionId The session ID
     * @param staleThresholdSeconds Number of seconds after which a heartbeat is considered stale
     * @return List of user IDs that were marked as offline
     */
    public java.util.List<String> markStaleParticipantsOffline(String sessionId, int staleThresholdSeconds) {
        SpeakingQueue queue = getOrCreateQueue(sessionId);
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(staleThresholdSeconds);
        java.util.List<String> markedOffline = new java.util.ArrayList<>();

        for (SessionParticipant participant : queue.getParticipants()) {
            if (participant.isOnline() && participant.getLastHeartbeat() != null
                    && participant.getLastHeartbeat().isBefore(threshold)) {
                participant.setOnline(false);
                markedOffline.add(participant.getUserId());
            }
        }

        if (!markedOffline.isEmpty()) {
            speakingQueueRepository.save(queue);
        }

        return markedOffline;
    }

    /**
     * Get all active session IDs (sessions with online participants)
     * @return List of session IDs with at least one online participant
     */
    public java.util.List<String> getActiveSessionIds() {
        java.util.List<SpeakingQueue> allQueues = speakingQueueRepository.findAll();
        return allQueues.stream()
                .filter(queue -> queue.getParticipants().stream().anyMatch(SessionParticipant::isOnline))
                .map(SpeakingQueue::getSessionId)
                .collect(java.util.stream.Collectors.toList());
    }
}
