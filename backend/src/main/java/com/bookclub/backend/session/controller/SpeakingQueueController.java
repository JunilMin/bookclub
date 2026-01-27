package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.dto.PresenceMessage;
import com.bookclub.backend.session.dto.QueueActionMessage;
import com.bookclub.backend.session.dto.ReorderQueueRequest;
import com.bookclub.backend.session.model.AttendanceRecord;
import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.service.AttendanceService;
import com.bookclub.backend.session.service.SpeakingQueueService;
import com.bookclub.backend.websocket.WebSocketSessionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
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
    private AttendanceService attendanceService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private WebSocketSessionRegistry sessionRegistry;

    /**
     * REST: Get speaking queue
     */
    @GetMapping("/{sessionId}/queue")
    public ResponseEntity<SpeakingQueue> getQueue(@PathVariable String sessionId) {
        SpeakingQueue queue = speakingQueueService.getOrCreateQueue(sessionId);
        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Join session and set participant online
     * This is a backup for WebSocket join message
     */
    @PostMapping("/{sessionId}/queue/join")
    public ResponseEntity<SpeakingQueue> joinQueue(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        logger.info("REST Join received: sessionId={}, userId={}, username={}",
                sessionId, message.getUserId(), message.getUsername());

        SpeakingQueue queue = speakingQueueService.addParticipant(
                sessionId,
                message.getUserId(),
                message.getUsername(),
                message.getPhotoUrl(),
                false
        );

        logger.info("Participant added via REST. Total: {}, Online: {}",
                queue.getParticipants().size(),
                queue.getParticipants().stream().filter(p -> p.isOnline()).count());

        // Broadcast to WebSocket subscribers
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", queue);

        // Track attendance - handle join
        try {
            AttendanceRecord attendance = attendanceService.handleJoin(
                    sessionId,
                    message.getUserId(),
                    message.getUsername(),
                    message.getPhotoUrl()
            );
            if (attendance != null) {
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
            }
        } catch (Exception e) {
            logger.error("Error tracking attendance join via REST: {}", e.getMessage());
        }

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

        // Track attendance - handle hand raise
        try {
            AttendanceRecord attendance = attendanceService.handleHandRaise(sessionId, message.getUserId());
            if (attendance != null) {
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
            }
        } catch (Exception e) {
            logger.error("Error tracking attendance hand raise via REST: {}", e.getMessage());
        }

        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Move to next speaker (host only)
     */
    @PostMapping("/{sessionId}/queue/next-speaker")
    public ResponseEntity<SpeakingQueue> nextSpeaker(@PathVariable String sessionId) {
        // Get current speaker before moving to next (to end their speaking time)
        SpeakingQueue beforeQueue = speakingQueueService.getOrCreateQueue(sessionId);
        if (beforeQueue.getCurrentSpeaker() != null) {
            String prevSpeakerId = beforeQueue.getCurrentSpeaker().getUserId();
            try {
                AttendanceRecord attendance = attendanceService.handleSpeakEnd(sessionId, prevSpeakerId);
                if (attendance != null) {
                    messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                }
            } catch (Exception e) {
                logger.error("Error tracking attendance speak end via REST: {}", e.getMessage());
            }
        }

        SpeakingQueue queue = speakingQueueService.nextSpeaker(sessionId);

        // Track new speaker start
        if (queue.getCurrentSpeaker() != null) {
            try {
                AttendanceRecord attendance = attendanceService.handleSpeakStart(
                        sessionId,
                        queue.getCurrentSpeaker().getUserId()
                );
                if (attendance != null) {
                    messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                }
            } catch (Exception e) {
                logger.error("Error tracking attendance speak start via REST: {}", e.getMessage());
            }
        }

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
     * REST: Add participant to queue (host only)
     */
    @PostMapping("/{sessionId}/queue/add-participant")
    public ResponseEntity<SpeakingQueue> addParticipantToQueue(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        SpeakingQueue queue = speakingQueueService.addParticipantToQueueByHost(
                sessionId,
                message.getUserId(),
                message.getUsername(),
                message.getPhotoUrl()
        );

        // Broadcast to WebSocket
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", queue);

        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Reorder queue (host only)
     */
    @PutMapping("/{sessionId}/queue/reorder")
    public ResponseEntity<SpeakingQueue> reorderQueue(
            @PathVariable String sessionId,
            @RequestBody ReorderQueueRequest request) {
        SpeakingQueue queue = speakingQueueService.reorderQueue(sessionId, request.getUserIds());

        // Broadcast to WebSocket
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", queue);

        return ResponseEntity.ok(queue);
    }

    /**
     * REST: Delegate moderator role to another participant (moderator only)
     */
    @PostMapping("/{sessionId}/queue/delegate-moderator")
    public ResponseEntity<SpeakingQueue> delegateModerator(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        try {
            SpeakingQueue queue = speakingQueueService.delegateModerator(sessionId, message.getUserId());

            // Broadcast to WebSocket
            logger.info("Broadcasting moderator change to /topic/session/{}/queue - new moderator: {}",
                    sessionId, message.getUserId());
            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", queue);

            return ResponseEntity.ok(queue);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * REST: Change voice chat mode (moderator only)
     */
    @PostMapping("/{sessionId}/queue/voice-chat-mode")
    public ResponseEntity<SpeakingQueue> changeVoiceChatMode(
            @PathVariable String sessionId,
            @RequestBody java.util.Map<String, String> body) {
        try {
            String modeStr = body.get("mode");
            if (modeStr == null) {
                return ResponseEntity.badRequest().build();
            }

            SpeakingQueue.VoiceChatMode mode = SpeakingQueue.VoiceChatMode.valueOf(modeStr.toUpperCase());
            SpeakingQueue queue = speakingQueueService.changeVoiceChatMode(sessionId, mode);

            // Broadcast to WebSocket
            logger.info("Broadcasting voice chat mode change to /topic/session/{}/queue - new mode: {}",
                    sessionId, mode);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", queue);

            return ResponseEntity.ok(queue);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * WebSocket: Handle session join (similar to DocEditController pattern)
     */
    @MessageMapping("/session/{sessionId}/join")
    public void handleSessionJoin(
            @DestinationVariable String sessionId,
            @Header("simpSessionId") String wsSessionId,
            QueueActionMessage message) {

        logger.info("=== Session JOIN received: sessionId={}, userId={}, username={}, wsSessionId={} ===",
                sessionId, message.getUserId(), message.getUsername(), wsSessionId);

        // Register in WebSocket session registry
        sessionRegistry.registerMeetingSession(wsSessionId, sessionId);

        // Add participant to queue
        SpeakingQueue updatedQueue = speakingQueueService.addParticipant(
                sessionId,
                message.getUserId(),
                message.getUsername(),
                message.getPhotoUrl(),
                false
        );

        logger.info("Participant added. Total: {}, Online: {}",
                updatedQueue.getParticipants().size(),
                updatedQueue.getParticipants().stream().filter(p -> p.isOnline()).count());

        // Broadcast updated queue
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", updatedQueue);

        // Track attendance - handle join
        try {
            AttendanceRecord attendance = attendanceService.handleJoin(
                    sessionId,
                    message.getUserId(),
                    message.getUsername(),
                    message.getPhotoUrl()
            );
            if (attendance != null) {
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
            }
        } catch (Exception e) {
            logger.error("Error tracking attendance join: {}", e.getMessage());
        }
    }

    /**
     * WebSocket: Handle session leave
     */
    @MessageMapping("/session/{sessionId}/leave")
    public void handleSessionLeave(
            @DestinationVariable String sessionId,
            @Header("simpSessionId") String wsSessionId,
            QueueActionMessage message) {

        logger.info("=== Session LEAVE received: sessionId={}, userId={}, wsSessionId={} ===",
                sessionId, message.getUserId(), wsSessionId);

        // Unregister from WebSocket session registry
        sessionRegistry.unregisterMeetingSession(wsSessionId, sessionId);

        // Set participant offline
        SpeakingQueue updatedQueue = speakingQueueService.setParticipantOffline(sessionId, message.getUserId());

        // Broadcast updated queue
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", updatedQueue);

        // Track attendance - handle leave
        try {
            AttendanceRecord attendance = attendanceService.handleLeave(sessionId, message.getUserId());
            if (attendance != null) {
                messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
            }
        } catch (Exception e) {
            logger.error("Error tracking attendance leave: {}", e.getMessage());
        }
    }

    /**
     * WebSocket: Handle queue actions
     */
    @MessageMapping("/session/{sessionId}/queue")
    @SendTo("/topic/session/{sessionId}/queue")
    public SpeakingQueue handleQueueAction(
            @DestinationVariable String sessionId,
            QueueActionMessage message) {

        SpeakingQueue result;
        switch (message.getAction()) {
            case "RAISE_HAND":
                result = speakingQueueService.raiseHand(
                        sessionId,
                        message.getUserId(),
                        message.getUsername(),
                        message.getPhotoUrl()
                );
                // Track attendance - handle hand raise
                try {
                    AttendanceRecord attendance = attendanceService.handleHandRaise(sessionId, message.getUserId());
                    if (attendance != null) {
                        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                    }
                } catch (Exception e) {
                    logger.error("Error tracking attendance hand raise: {}", e.getMessage());
                }
                return result;
            case "NEXT_SPEAKER":
                // Get current speaker before moving to next (to end their speaking time)
                SpeakingQueue beforeQueue = speakingQueueService.getOrCreateQueue(sessionId);
                if (beforeQueue.getCurrentSpeaker() != null) {
                    String prevSpeakerId = beforeQueue.getCurrentSpeaker().getUserId();
                    try {
                        AttendanceRecord attendance = attendanceService.handleSpeakEnd(sessionId, prevSpeakerId);
                        if (attendance != null) {
                            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                        }
                    } catch (Exception e) {
                        logger.error("Error tracking attendance speak end: {}", e.getMessage());
                    }
                }
                result = speakingQueueService.nextSpeaker(sessionId);
                // Track new speaker start
                if (result.getCurrentSpeaker() != null) {
                    try {
                        AttendanceRecord attendance = attendanceService.handleSpeakStart(
                                sessionId,
                                result.getCurrentSpeaker().getUserId()
                        );
                        if (attendance != null) {
                            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                        }
                    } catch (Exception e) {
                        logger.error("Error tracking attendance speak start: {}", e.getMessage());
                    }
                }
                return result;
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
            @Header("simpSessionId") String wsSessionId,
            PresenceMessage message) {

        logger.info("=== Presence received: sessionId={}, action={}, userId={}, username={}, wsSessionId={} ===",
                sessionId, message.getAction(), message.getUserId(), message.getUsername(), wsSessionId);

        SpeakingQueue updatedQueue = null;

        if ("JOIN".equals(message.getAction())) {
            // Register this meeting session in the WebSocket session registry
            sessionRegistry.registerMeetingSession(wsSessionId, sessionId);

            updatedQueue = speakingQueueService.addParticipant(
                    sessionId,
                    message.getUserId(),
                    message.getUsername(),
                    message.getPhotoUrl(),
                    false
            );
            logger.info("User {} added to session {}. Total participants: {}",
                    message.getUsername(), sessionId, updatedQueue.getParticipants().size());

            // Track attendance - handle join
            try {
                AttendanceRecord attendance = attendanceService.handleJoin(
                        sessionId,
                        message.getUserId(),
                        message.getUsername(),
                        message.getPhotoUrl()
                );
                if (attendance != null) {
                    messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                }
            } catch (Exception e) {
                logger.error("Error tracking attendance join via presence: {}", e.getMessage());
            }
        } else if ("LEAVE".equals(message.getAction())) {
            // Unregister this meeting session from the WebSocket session registry
            sessionRegistry.unregisterMeetingSession(wsSessionId, sessionId);

            updatedQueue = speakingQueueService.setParticipantOffline(sessionId, message.getUserId());
            logger.info("User {} left session {}.", message.getUsername(), sessionId);

            // Track attendance - handle leave
            try {
                AttendanceRecord attendance = attendanceService.handleLeave(sessionId, message.getUserId());
                if (attendance != null) {
                    messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/attendance", attendance);
                }
            } catch (Exception e) {
                logger.error("Error tracking attendance leave via presence: {}", e.getMessage());
            }
        } else if ("HEARTBEAT".equals(message.getAction())) {
            // Update heartbeat timestamp for the user
            speakingQueueService.updateHeartbeat(sessionId, message.getUserId());
            // Also update attendance heartbeat
            try {
                attendanceService.handleHeartbeat(sessionId, message.getUserId());
            } catch (Exception e) {
                logger.debug("Error tracking attendance heartbeat: {}", e.getMessage());
            }
            logger.debug("Heartbeat received from user {} in session {}", message.getUserId(), sessionId);
            // Don't broadcast heartbeats to reduce traffic
            return message;
        }

        // Broadcast updated queue to all subscribers
        if (updatedQueue != null) {
            logger.info("Broadcasting updated queue to /topic/session/{}/queue", sessionId);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", updatedQueue);
        }

        return message;
    }

    /**
     * REST: Receive heartbeat (alternative to WebSocket heartbeat)
     */
    @PostMapping("/{sessionId}/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable String sessionId,
            @RequestBody QueueActionMessage message) {
        speakingQueueService.updateHeartbeat(sessionId, message.getUserId());
        return ResponseEntity.ok().build();
    }
}
