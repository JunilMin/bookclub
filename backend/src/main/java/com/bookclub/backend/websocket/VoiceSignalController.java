package com.bookclub.backend.websocket;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.websocket.dto.SignalMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Optional;

/**
 * WebSocket controller for WebRTC voice chat signaling.
 * Handles OFFER, ANSWER, and ICE candidate exchanges between peers.
 *
 * All messages are validated for membership before relay.
 */
@Controller
public class VoiceSignalController {

    private static final Logger logger = LoggerFactory.getLogger(VoiceSignalController.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    /**
     * Handle incoming WebRTC signaling messages.
     * Route: /app/session/{sessionId}/signal
     *
     * Validates membership and relays signal to target user via:
     * /topic/session/{sessionId}/signal/{toUserId}
     */
    @MessageMapping("/session/{sessionId}/signal")
    public void handleSignal(
            @DestinationVariable String sessionId,
            SignalMessage message,
            Principal principal) {

        logger.debug("Signal received: type={}, from={}, to={}, sessionId={}",
                message.getType(), message.getFromUserId(), message.getToUserId(), sessionId);

        // Extract userId from principal
        String senderUserId = extractUserId(principal);
        if (senderUserId == null) {
            logger.warn("Signal rejected: no authenticated user");
            return;
        }

        // Validate sender matches message
        if (!senderUserId.equals(message.getFromUserId())) {
            logger.warn("Signal rejected: sender mismatch. Principal: {}, Message: {}",
                    senderUserId, message.getFromUserId());
            return;
        }

        // Validate membership
        if (!isMemberOfSession(sessionId, senderUserId)) {
            logger.warn("Signal rejected: user {} is not a member of session {}", senderUserId, sessionId);
            return;
        }

        // Validate target user is also a member (if toUserId is specified)
        if (message.getToUserId() != null && !message.getToUserId().isEmpty()) {
            if (!isMemberOfSession(sessionId, message.getToUserId())) {
                logger.warn("Signal rejected: target user {} is not a member of session {}",
                        message.getToUserId(), sessionId);
                return;
            }

            // Send to specific user
            String destination = "/topic/session/" + sessionId + "/signal/" + message.getToUserId();
            messagingTemplate.convertAndSend(destination, message);
            logger.debug("Signal relayed to {}", destination);
        } else {
            // Broadcast to all (used for JOIN notifications)
            String destination = "/topic/session/" + sessionId + "/signal";
            messagingTemplate.convertAndSend(destination, message);
            logger.debug("Signal broadcast to {}", destination);
        }
    }

    /**
     * Extract user ID from Principal.
     */
    private String extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken) {
            Object p = ((UsernamePasswordAuthenticationToken) principal).getPrincipal();
            if (p instanceof WebSocketPrincipal) {
                return ((WebSocketPrincipal) p).getUserId();
            }
        }
        return null;
    }

    /**
     * Check if user is a member of the session's post.
     *
     * Flow:
     * 1. Session → get postId
     * 2. Post → check memberIds contains userId OR createrId equals userId
     */
    private boolean isMemberOfSession(String sessionId, String userId) {
        try {
            // Get session
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            if (sessionOpt.isEmpty()) {
                logger.debug("Session not found: {}", sessionId);
                return false;
            }
            Session session = sessionOpt.get();

            // Get post
            Optional<Post> postOpt = postRepository.findById(session.getPostId());
            if (postOpt.isEmpty()) {
                logger.debug("Post not found for session: {}", sessionId);
                return false;
            }
            Post post = postOpt.get();

            // Check if user is member or creator
            boolean isMember = post.getMemberIds() != null && post.getMemberIds().contains(userId);
            boolean isCreator = post.getCreaterId() != null && post.getCreaterId().equals(userId);

            // Also check if user is blocked
            boolean isBlocked = post.getBlockedIds() != null && post.getBlockedIds().contains(userId);

            if (isBlocked) {
                logger.debug("User {} is blocked from session {}", userId, sessionId);
                return false;
            }

            return isMember || isCreator;
        } catch (Exception e) {
            logger.error("Error checking membership: {}", e.getMessage());
            return false;
        }
    }
}
