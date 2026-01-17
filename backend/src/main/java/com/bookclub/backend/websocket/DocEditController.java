package com.bookclub.backend.websocket;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

/**
 * Op-based Collaborative Document Editing WebSocket Controller
 *
 * 핵심 원칙:
 * 1. Stateless: 서버는 상태 저장 ❌, 연산(op)만 중계
 * 2. 클라이언트가 보낸 step을 그대로 다른 클라이언트들에게 broadcast
 * 3. Presence 정보만 메모리에 유지 (재접속 시 현재 사용자 목록 제공)
 *
 * Topics:
 * - /app/docs/{docId}/edit → /topic/docs/{docId}/edit (op 중계)
 * - /app/docs/{docId}/presence → /topic/docs/{docId}/presence (presence 중계)
 * - /app/docs/{docId}/join → /topic/docs/{docId}/users (사용자 목록 갱신)
 * - /app/docs/{docId}/leave → /topic/docs/{docId}/users (사용자 목록 갱신)
 */
@Controller
public class DocEditController {

    private static final Logger logger = LoggerFactory.getLogger(DocEditController.class);

    private final SimpMessagingTemplate messagingTemplate;

    // Presence 저장 (docId -> List<UserInfo>)
    // 서버 재시작 시 초기화됨 (stateless 원칙)
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, UserInfo>> documentUsers = new ConcurrentHashMap<>();

    public DocEditController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Edit Operation 중계
     * 클라이언트가 보낸 step을 그대로 다른 클라이언트들에게 broadcast
     * 서버는 내용을 해석하지 않음 (stateless)
     */
    @MessageMapping("/docs/{docId}/edit")
    @SendTo("/topic/docs/{docId}/edit")
    public Map<String, Object> handleEdit(
            @DestinationVariable String docId,
            @Payload Map<String, Object> editOperation) {

        logger.debug("Edit op received for doc {}: clientId={}", docId, editOperation.get("clientId"));

        // 그대로 broadcast (stateless)
        return editOperation;
    }

    /**
     * Presence 중계
     * 커서 위치, 선택 영역 등을 다른 클라이언트들에게 broadcast
     */
    @MessageMapping("/docs/{docId}/presence")
    @SendTo("/topic/docs/{docId}/presence")
    public Map<String, Object> handlePresence(
            @DestinationVariable String docId,
            @Payload Map<String, Object> presenceOperation) {

        logger.debug("Presence received for doc {}: userId={}", docId, presenceOperation.get("userId"));

        // 그대로 broadcast (stateless)
        return presenceOperation;
    }

    /**
     * 사용자 입장
     * presence 목록에 추가 후 전체 사용자 목록 broadcast
     * 같은 userId로 재입장 시 기존 세션 제거 (새로고침 대응)
     */
    @MessageMapping("/docs/{docId}/join")
    public void handleJoin(
            @DestinationVariable String docId,
            @Payload Map<String, Object> joinMessage,
            SimpMessageHeaderAccessor headerAccessor) {

        String userId = (String) joinMessage.get("userId");
        String username = (String) joinMessage.get("username");
        String clientId = (String) joinMessage.get("clientId");
        String photoUrl = (String) joinMessage.getOrDefault("photoUrl", "");

        logger.info("User joined doc {}: userId={}, username={}, clientId={}", docId, userId, username, clientId);

        ConcurrentHashMap<String, UserInfo> users = documentUsers.computeIfAbsent(docId, k -> new ConcurrentHashMap<>());

        // Remove any existing sessions for the same userId (handles refresh case)
        List<String> oldClientIds = users.entrySet().stream()
                .filter(e -> e.getValue().getUserId().equals(userId) && !e.getKey().equals(clientId))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        for (String oldClientId : oldClientIds) {
            users.remove(oldClientId);
            logger.info("Removed stale session for userId={}, oldClientId={}", userId, oldClientId);
        }

        // Add new session
        users.put(clientId, new UserInfo(userId, username, clientId, photoUrl, System.currentTimeMillis()));

        // Broadcast updated user list
        broadcastUserList(docId);
    }

    /**
     * 사용자 퇴장
     * presence 목록에서 제거 후 전체 사용자 목록 broadcast
     */
    @MessageMapping("/docs/{docId}/leave")
    public void handleLeave(
            @DestinationVariable String docId,
            @Payload Map<String, Object> leaveMessage) {

        String clientId = (String) leaveMessage.get("clientId");

        logger.info("User left doc {}: clientId={}", docId, clientId);

        // Remove from presence
        ConcurrentHashMap<String, UserInfo> users = documentUsers.get(docId);
        if (users != null) {
            users.remove(clientId);
            if (users.isEmpty()) {
                documentUsers.remove(docId);
            }
        }

        // Broadcast updated user list
        broadcastUserList(docId);
    }

    /**
     * 현재 문서의 사용자 목록 broadcast
     */
    private void broadcastUserList(String docId) {
        ConcurrentHashMap<String, UserInfo> users = documentUsers.get(docId);

        List<Map<String, Object>> userList = new ArrayList<>();
        if (users != null) {
            userList = users.values().stream()
                    .map(UserInfo::toMap)
                    .collect(Collectors.toList());
        }

        Map<String, Object> response = Map.of(
                "type", "users",
                "docId", docId,
                "users", userList
        );

        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/users", response);
    }

    /**
     * User Info (내부 클래스)
     */
    private static class UserInfo {
        private final String userId;
        private final String username;
        private final String clientId;
        private final String photoUrl;
        private final long joinedAt;
        private String color;

        public UserInfo(String userId, String username, String clientId, String photoUrl, long joinedAt) {
            this.userId = userId;
            this.username = username;
            this.clientId = clientId;
            this.photoUrl = photoUrl != null ? photoUrl : "";
            this.joinedAt = joinedAt;
            this.color = generateColor(userId);
        }

        public String getUserId() {
            return userId;
        }

        private String generateColor(String userId) {
            String[] colors = {
                    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
                    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
                    "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1"
            };
            int hash = 0;
            for (char c : userId.toCharArray()) {
                hash = c + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        }

        public Map<String, Object> toMap() {
            return Map.of(
                    "userId", userId,
                    "username", username,
                    "clientId", clientId,
                    "photoUrl", photoUrl,
                    "joinedAt", joinedAt,
                    "color", color
            );
        }
    }
}
