package com.bookclub.backend.session.service;

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

    private static final int DEFAULT_SPEAKING_TIME = 180; // 3 minutes

    public SpeakingQueue getOrCreateQueue(String sessionId) {
        Optional<SpeakingQueue> queueOpt = speakingQueueRepository.findFirstBySessionId(sessionId);
        if (queueOpt.isPresent()) {
            return queueOpt.get();
        }

        SpeakingQueue queue = new SpeakingQueue(sessionId);
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
            return speakingQueueRepository.save(queue);
        }

        // Update online status if participant exists
        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> p.setOnline(true));

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

        queue.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .ifPresent(p -> p.setOnline(false));

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
}
