package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.dto.PresenceMessage;
import com.bookclub.backend.session.dto.QueueActionMessage;
import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.service.SpeakingQueueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class SpeakingQueueController {

    @Autowired
    private SpeakingQueueService speakingQueueService;

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
                message.getOdUserId(),
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
        SpeakingQueue queue = speakingQueueService.removeFromQueue(sessionId, message.getOdUserId());
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
                        message.getOdUserId(),
                        message.getUsername(),
                        message.getPhotoUrl()
                );
            case "NEXT_SPEAKER":
                return speakingQueueService.nextSpeaker(sessionId);
            case "REMOVE":
                return speakingQueueService.removeFromQueue(sessionId, message.getOdUserId());
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

        if ("JOIN".equals(message.getAction())) {
            speakingQueueService.addParticipant(
                    sessionId,
                    message.getOdUserId(),
                    message.getUsername(),
                    message.getPhotoUrl(),
                    false
            );
        } else if ("LEAVE".equals(message.getAction())) {
            speakingQueueService.setParticipantOffline(sessionId, message.getOdUserId());
        }

        return message;
    }
}
