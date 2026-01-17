package com.bookclub.backend.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry to track WebSocket session to user mappings.
 * Used to determine which user disconnected when a WebSocket session ends.
 */
@Component
public class WebSocketSessionRegistry {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketSessionRegistry.class);

    // Maps WebSocket session ID -> User session info
    private final Map<String, UserSessionInfo> sessionToUser = new ConcurrentHashMap<>();

    // Maps userId -> Set of WebSocket session IDs (a user can have multiple connections)
    private final Map<String, Set<String>> userToSessions = new ConcurrentHashMap<>();

    /**
     * Register a WebSocket session for a user
     */
    public void registerSession(String wsSessionId, String userId, String username, String photoUrl) {
        UserSessionInfo info = new UserSessionInfo(userId, username, photoUrl);
        sessionToUser.put(wsSessionId, info);

        userToSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(wsSessionId);

        logger.info("Registered WebSocket session {} for user {} ({})", wsSessionId, username, userId);
    }

    /**
     * Register a meeting room session ID for a WebSocket session
     */
    public void registerMeetingSession(String wsSessionId, String meetingSessionId) {
        UserSessionInfo info = sessionToUser.get(wsSessionId);
        if (info != null) {
            info.getMeetingSessionIds().add(meetingSessionId);
            logger.info("User {} joined meeting session {}", info.getUsername(), meetingSessionId);
        }
    }

    /**
     * Unregister a meeting room session ID from a WebSocket session
     */
    public void unregisterMeetingSession(String wsSessionId, String meetingSessionId) {
        UserSessionInfo info = sessionToUser.get(wsSessionId);
        if (info != null) {
            info.getMeetingSessionIds().remove(meetingSessionId);
            logger.info("User {} left meeting session {}", info.getUsername(), meetingSessionId);
        }
    }

    /**
     * Unregister a WebSocket session
     * @return UserSessionInfo if found, null otherwise
     */
    public UserSessionInfo unregisterSession(String wsSessionId) {
        UserSessionInfo info = sessionToUser.remove(wsSessionId);

        if (info != null) {
            Set<String> sessions = userToSessions.get(info.getUserId());
            if (sessions != null) {
                sessions.remove(wsSessionId);
                if (sessions.isEmpty()) {
                    userToSessions.remove(info.getUserId());
                }
            }
            logger.info("Unregistered WebSocket session {} for user {} ({})", wsSessionId, info.getUsername(), info.getUserId());
        }

        return info;
    }

    /**
     * Get user info for a WebSocket session
     */
    public UserSessionInfo getUserSessionInfo(String wsSessionId) {
        return sessionToUser.get(wsSessionId);
    }

    /**
     * Check if a user has any active WebSocket connections
     */
    public boolean hasActiveConnection(String userId) {
        Set<String> sessions = userToSessions.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    /**
     * Get the number of active connections for a user
     */
    public int getActiveConnectionCount(String userId) {
        Set<String> sessions = userToSessions.get(userId);
        return sessions != null ? sessions.size() : 0;
    }

    /**
     * User session information holder
     */
    public static class UserSessionInfo {
        private final String userId;
        private final String username;
        private final String photoUrl;
        private final Set<String> meetingSessionIds = ConcurrentHashMap.newKeySet();

        public UserSessionInfo(String userId, String username, String photoUrl) {
            this.userId = userId;
            this.username = username;
            this.photoUrl = photoUrl;
        }

        public String getUserId() {
            return userId;
        }

        public String getUsername() {
            return username;
        }

        public String getPhotoUrl() {
            return photoUrl;
        }

        public Set<String> getMeetingSessionIds() {
            return meetingSessionIds;
        }
    }
}
