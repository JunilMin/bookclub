package com.bookclub.backend.session.service;

import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.model.SpeakingQueue.*;
import com.bookclub.backend.session.repository.SpeakingQueueRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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

        if (queue.getQueue().isEmpty()) {
            queue.setCurrentSpeaker(null);
        } else {
            QueuedParticipant next = queue.getQueue().remove(0);

            // Update hand status for previous speaker
            if (queue.getCurrentSpeaker() != null) {
                queue.getParticipants().stream()
                        .filter(p -> p.getUserId().equals(queue.getCurrentSpeaker().getUserId()))
                        .findFirst()
                        .ifPresent(p -> p.setHasRaisedHand(false));
            }

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
}
