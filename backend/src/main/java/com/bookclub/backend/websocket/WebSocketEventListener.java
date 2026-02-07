package com.bookclub.backend.websocket;

import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.service.SpeakingQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.security.Principal;

/**
 * Listener for WebSocket lifecycle events.
 * Handles disconnect events to mark users as offline when their connection drops.
 */
@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    @Autowired
    private WebSocketSessionRegistry sessionRegistry;

    @Autowired
    private SpeakingQueueService speakingQueueService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Handle WebSocket connection events
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = headerAccessor.getSessionId();
        Principal principal = headerAccessor.getUser();

        if (principal instanceof org.springframework.security.authentication.UsernamePasswordAuthenticationToken) {
            Object p = ((org.springframework.security.authentication.UsernamePasswordAuthenticationToken) principal).getPrincipal();
            if (p instanceof WebSocketPrincipal) {
                WebSocketPrincipal wsPrincipal = (WebSocketPrincipal) p;
                // Note: username and photoUrl will be set when user joins a meeting session
                sessionRegistry.registerSession(wsSessionId, wsPrincipal.getUserId(), null, null);
                logger.info("WebSocket connected: sessionId={}, userId={}", wsSessionId, wsPrincipal.getUserId());
            }
        }
    }

    /**
     * Handle WebSocket subscription events to track which meeting sessions user joined
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();

        // Track subscription to session presence topics
        if (destination != null && destination.startsWith("/topic/session/") && destination.endsWith("/presence")) {
            // Extract session ID from /topic/session/{sessionId}/presence
            String[] parts = destination.split("/");
            if (parts.length >= 4) {
                String meetingSessionId = parts[3];
                sessionRegistry.registerMeetingSession(wsSessionId, meetingSessionId);
                logger.info("User subscribed to meeting session {}", meetingSessionId);
            }
        }
    }

    /**
     * Handle WebSocket disconnect events.
     * This is called when the connection is closed (either gracefully or abruptly).
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = headerAccessor.getSessionId();

        logger.info("WebSocket disconnect event: sessionId={}", wsSessionId);

        // Get user info before unregistering
        WebSocketSessionRegistry.UserSessionInfo userInfo = sessionRegistry.getUserSessionInfo(wsSessionId);

        if (userInfo != null) {
            String userId = userInfo.getUserId();

            // Mark user as offline in all meeting sessions they were part of
            for (String meetingSessionId : userInfo.getMeetingSessionIds()) {
                try {
                    logger.info("Marking user {} as offline in session {} due to disconnect",
                            userId, meetingSessionId);

                    SpeakingQueue updatedQueue = speakingQueueService.setParticipantOffline(meetingSessionId, userId);

                    // Broadcast updated queue to all subscribers
                    messagingTemplate.convertAndSend("/topic/session/" + meetingSessionId + "/queue", updatedQueue);

                    logger.info("Broadcasted offline status for user {} in session {}", userId, meetingSessionId);
                } catch (Exception e) {
                    logger.error("Error setting user {} offline in session {}: {}",
                            userId, meetingSessionId, e.getMessage());
                }
            }

            // Unregister the WebSocket session
            sessionRegistry.unregisterSession(wsSessionId);
        }
    }
}
