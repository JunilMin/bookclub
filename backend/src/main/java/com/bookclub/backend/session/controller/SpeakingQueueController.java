package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.dto.PresenceMessage;
import com.bookclub.backend.session.dto.QueueActionMessage;
import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.service.SpeakingQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class SpeakingQueueController {

    private static final Logger logger = LoggerFactory.getLogger(SpeakingQueueController.class);

    @Autowired
    private SpeakingQueueService speakingQueueService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * REST: Get speaking queue
     */
    @GetMapping("/{sessionId}/queue")
    public ResponseEntity<SpeakingQueue> getQueue(@PathVariable String sessionId) {
        SpeakingQueue queue = speakingQueueService.getOrCreateQueue(sessionId);
        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Raise/lower hand
     */
    @PostMapping("/{sessionId}/queue/raise-hand")
    public ResponseEntity<SpeakingQueue> raiseHand(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        SpeakingQueue queue = speakingQueueService.raiseHand(
                sessionId,
                message.getUserId(),
                message.getUsername(),
                message.getPhotoUrl()
        );
        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Move to next speaker (host only)
     */
    @PostMapping("/{sessionId}/queue/next-speaker")
    public ResponseEntity<SpeakingQueue> nextSpeaker(@PathVariable String sessionId) {
        SpeakingQueue queue = speakingQueueService.nextSpeaker(sessionId);
        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Remove from queue
     */
    @PostMapping("/{sessionId}/queue/remove")
    public ResponseEntity<SpeakingQueue> removeFromQueue(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        SpeakingQueue queue = speakingQueueService.removeFromQueue(sessionId, message.getUserId());
        return ResponseEntity.ok(queue);
    }

    /**
     * WebSocket: Handle queue actions
     */
    @MessageMapping("/session/{sessionId}/queue")
    @SendTo("/topic/session/{sessionId}/queue")
    public SpeakingQueue handleQueueAction(
            @DestinationVariable String sessionId,
            QueueActionMessage message) {

        switch (message.getAction()) {
            case "RAISE_HAND":
                return speakingQueueService.raiseHand(
                        sessionId,
                        message.getUserId(),
                        message.getUsername(),
                        message.getPhotoUrl()
                );
            case "NEXT_SPEAKER":
                return speakingQueueService.nextSpeaker(sessionId);
            case "REMOVE":
                return speakingQueueService.removeFromQueue(sessionId, message.getUserId());
            default:
                return speakingQueueService.getOrCreateQueue(sessionId);
        }
    }

    /**
     * WebSocket: Handle presence updates
     */
    @MessageMapping("/session/{sessionId}/presence")
    @SendTo("/topic/session/{sessionId}/presence")
    public PresenceMessage handlePresence(
            @DestinationVariable String sessionId,
            PresenceMessage message) {

        logger.info("=== Presence received: sessionId={}, action={}, userId={}, username={} ===",
                sessionId, message.getAction(), message.getUserId(), message.getUsername());

        SpeakingQueue updatedQueue = null;

        if ("JOIN".equals(message.getAction())) {
            updatedQueue = speakingQueueService.addParticipant(
                    sessionId,
                    message.getUserId(),
                    message.getUsername(),
                    message.getPhotoUrl(),
                    false
            );
            logger.info("User {} added to session {}. Total participants: {}",
                    message.getUsername(), sessionId, updatedQueue.getParticipants().size());
        } else if ("LEAVE".equals(message.getAction())) {
            updatedQueue = speakingQueueService.setParticipantOffline(sessionId, message.getUserId());
            logger.info("User {} left session {}.", message.getUsername(), sessionId);
        }

        // Broadcast updated queue to all subscribers
        if (updatedQueue != null) {
            logger.info("Broadcasting updated queue to /topic/session/{}/queue", sessionId);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", updatedQueue);
        }

        return message;
    }
}
