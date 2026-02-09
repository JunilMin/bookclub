package com.bookclub.backend.websocket;

import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.service.SessionNoteService;
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
import java.util.HashMap;
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
    private final DocLockService docLockService;
    private final SessionNoteService sessionNoteService;

    // Presence 저장 (docId -> List<UserInfo>)
    // 서버 재시작 시 초기화됨 (stateless 원칙)
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, UserInfo>> documentUsers = new ConcurrentHashMap<>();

    public DocEditController(
            SimpMessagingTemplate messagingTemplate,
            DocLockService docLockService,
            SessionNoteService sessionNoteService) {
        this.messagingTemplate = messagingTemplate;
        this.docLockService = docLockService;
        this.sessionNoteService = sessionNoteService;
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
     * Block Reorder 처리 (v2.0)
     * 블록 순서 변경을 DB에 저장 후 다른 클라이언트들에게 broadcast
     */
    @MessageMapping("/docs/{docId}/reorder")
    public void handleReorder(
            @DestinationVariable String docId,
            @Payload Map<String, Object> reorderOperation) {

        String blockId = (String) reorderOperation.get("blockId");
        Integer fromIndex = reorderOperation.get("fromIndex") != null
            ? ((Number) reorderOperation.get("fromIndex")).intValue()
            : -1;
        Integer toIndex = reorderOperation.get("toIndex") != null
            ? ((Number) reorderOperation.get("toIndex")).intValue()
            : -1;
        String userId = (String) reorderOperation.get("userId");

        logger.debug("Reorder received for doc {}: blockId={}, from={} to={}",
                docId, blockId, fromIndex, toIndex);

        // Get current block order
        List<String> blockOrder = sessionNoteService.getBlockOrder(docId);
        if (blockOrder == null || blockOrder.isEmpty()) {
            logger.warn("Block order is empty for doc {}", docId);
            return;
        }

        // Apply reorder
        int currentIndex = blockOrder.indexOf(blockId);
        if (currentIndex == -1) {
            logger.warn("Block {} not found in blockOrder for doc {}", blockId, docId);
            return;
        }

        // Remove from current position and insert at new position
        blockOrder.remove(currentIndex);
        int insertIndex = Math.min(toIndex, blockOrder.size());
        blockOrder.add(insertIndex, blockId);

        // Persist to database
        sessionNoteService.updateBlockOrder(docId, blockOrder, userId);

        // Broadcast to all clients
        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/reorder", reorderOperation);
    }

    /**
     * Block Lock 처리 (v1.5)
     * DocLockService를 사용하여 서버 측에서 락 관리
     */
    @MessageMapping("/docs/{docId}/lock")
    public void handleLock(
            @DestinationVariable String docId,
            @Payload Map<String, Object> lockOperation) {

        String lockType = (String) lockOperation.get("type");
        String blockId = (String) lockOperation.get("blockId");
        String userId = (String) lockOperation.get("userId");
        String username = (String) lockOperation.get("username");
        String clientId = (String) lockOperation.get("clientId");
        String lockToken = (String) lockOperation.get("lockToken");

        logger.debug("Lock {} received for doc {}: blockId={}, userId={}",
                lockType, docId, blockId, userId);

        Map<String, Object> response = new java.util.HashMap<>(lockOperation);

        switch (lockType) {
            case "lock_request" -> {
                DocLockService.LockResult result = docLockService.requestLock(docId, blockId, userId, username, clientId);
                if (result.isSuccess()) {
                    response.put("type", "lock_acquired");
                    response.put("lockToken", result.getLockInfo().getLockToken());
                    response.put("lockUntil", result.getLockInfo().getLockUntil());
                } else {
                    response.put("type", "lock_denied");
                    response.put("reason", result.getReason());
                    if (result.getLockInfo() != null) {
                        response.put("lockedBy", result.getLockInfo().getUserId());
                        response.put("lockedByUsername", result.getLockInfo().getUsername());
                    }
                }
            }
            case "lock_renew" -> {
                DocLockService.LockResult result = docLockService.renewLock(docId, blockId, userId, lockToken);
                if (result.isSuccess()) {
                    response.put("type", "lock_acquired");
                    response.put("lockUntil", result.getLockInfo().getLockUntil());
                } else {
                    response.put("type", "lock_denied");
                    response.put("reason", result.getReason());
                }
            }
            case "lock_release" -> {
                boolean released = docLockService.releaseLock(docId, blockId, userId, lockToken);
                if (released) {
                    response.put("type", "lock_release");
                } else {
                    // Still broadcast release to clear stale client state
                    response.put("type", "lock_release");
                }
            }
            case "lock_acquired" -> {
                // Client claims a lock (e.g., for newly created blocks) - register it on server
                DocLockService.LockResult result = docLockService.requestLock(docId, blockId, userId, username, clientId);
                if (result.isSuccess()) {
                    response.put("type", "lock_acquired");
                    response.put("lockToken", result.getLockInfo().getLockToken());
                    response.put("lockUntil", result.getLockInfo().getLockUntil());
                } else {
                    response.put("type", "lock_denied");
                    response.put("reason", result.getReason());
                }
            }
            default -> {
                logger.warn("Unknown lock type: {}", lockType);
                return;
            }
        }

        // Broadcast to all clients
        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/lock", response);
    }

    // ============================================
    // Block-level Operations (v2.0)
    // ============================================

    /**
     * Block Content Preview 처리 (v2.1)
     * 실시간 동기화를 위한 preview 브로드캐스트 (DB 저장 없음)
     * Preview is best-effort - no strict lock check needed since it doesn't modify data
     */
    @MessageMapping("/docs/{docId}/block/preview")
    public void handleBlockPreview(
            @DestinationVariable String docId,
            @Payload Map<String, Object> operation) {

        String blockId = (String) operation.get("blockId");
        String userId = (String) operation.get("userId");

        logger.debug("Block preview received for doc {}: blockId={}, userId={}", docId, blockId, userId);

        // Broadcast to all clients immediately (no DB save, no lock check)
        // Lock enforcement is only on block_update (which modifies DB)
        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/preview", operation);
    }

    /**
     * Block Update 처리 (v2.0)
     * 락을 보유한 사용자만 업데이트 가능
     */
    @MessageMapping("/docs/{docId}/block/update")
    public void handleBlockUpdate(
            @DestinationVariable String docId,
            @Payload Map<String, Object> operation) {

        String blockId = (String) operation.get("blockId");
        String userId = (String) operation.get("userId");
        String content = (String) operation.get("content");
        Integer version = operation.get("version") != null
            ? ((Number) operation.get("version")).intValue()
            : 0;

        logger.debug("Block update received for doc {}: blockId={}, userId={}", docId, blockId, userId);

        // Verify lock ownership
        DocLockService.LockInfo lockInfo = docLockService.getLockInfo(docId, blockId);
        if (lockInfo == null || !lockInfo.getUserId().equals(userId)) {
            logger.warn("Block update rejected - no lock or wrong owner: blockId={}, userId={}", blockId, userId);

            // Send rejection to requesting client only
            Map<String, Object> rejection = new HashMap<>(operation);
            rejection.put("type", "block_update_rejected");
            rejection.put("reason", lockInfo == null ? "NO_LOCK" : "WRONG_OWNER");
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/update", rejection);
            return;
        }

        // Persist to database
        SessionNote.Block updatedBlock = sessionNoteService.updateBlockContent(
            docId, blockId, content, userId, version
        );

        if (updatedBlock == null) {
            // Version conflict
            Map<String, Object> rejection = new HashMap<>(operation);
            rejection.put("type", "block_update_rejected");
            rejection.put("reason", "VERSION_CONFLICT");
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/update", rejection);
            return;
        }

        // Broadcast to all clients
        Map<String, Object> response = new HashMap<>(operation);
        response.put("type", "block_update");
        response.put("version", updatedBlock.getVersion());
        response.put("updatedAt", updatedBlock.getUpdatedAt().toString());

        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/update", response);
    }

    /**
     * Block Add 처리 (v2.0)
     * 새 블록 추가
     */
    @MessageMapping("/docs/{docId}/block/add")
    public void handleBlockAdd(
            @DestinationVariable String docId,
            @Payload Map<String, Object> operation) {

        String type = (String) operation.get("blockType");
        String content = (String) operation.get("content");
        String afterBlockId = (String) operation.get("afterBlockId");
        String userId = (String) operation.get("userId");
        String username = (String) operation.get("username");
        String clientId = (String) operation.get("clientId");
        String tempBlockId = (String) operation.get("tempBlockId"); // Client's temporary ID

        logger.debug("Block add received for doc {}: type={}, afterBlockId={}, userId={}, tempBlockId={}",
            docId, type, afterBlockId, userId, tempBlockId);

        // Create block in database
        SessionNote.Block newBlock = sessionNoteService.addBlock(docId, type, content, afterBlockId, userId);

        // Auto-register lock for creator (so preview/update work immediately)
        DocLockService.LockResult lockResult = docLockService.requestLock(docId, newBlock.getId(), userId, username, clientId);

        // Broadcast to all clients
        Map<String, Object> response = new HashMap<>();
        response.put("type", "block_add");
        response.put("docId", docId);
        response.put("block", blockToMap(newBlock));
        response.put("afterBlockId", afterBlockId);
        response.put("userId", userId);
        response.put("username", username);
        response.put("clientId", clientId);
        response.put("tempBlockId", tempBlockId); // Include for tempId → serverId mapping
        response.put("timestamp", System.currentTimeMillis());

        // Include lock info in response for creator to update their lock state
        if (lockResult.isSuccess()) {
            response.put("lockToken", lockResult.getLockInfo().getLockToken());
            response.put("lockUntil", lockResult.getLockInfo().getLockUntil());
        }

        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/add", response);

        // Also broadcast lock_acquired on lock topic for other clients
        if (lockResult.isSuccess()) {
            Map<String, Object> lockResponse = new HashMap<>();
            lockResponse.put("type", "lock_acquired");
            lockResponse.put("docId", docId);
            lockResponse.put("blockId", newBlock.getId());
            lockResponse.put("userId", userId);
            lockResponse.put("username", username);
            lockResponse.put("clientId", clientId);
            lockResponse.put("lockToken", lockResult.getLockInfo().getLockToken());
            lockResponse.put("lockUntil", lockResult.getLockInfo().getLockUntil());
            lockResponse.put("timestamp", System.currentTimeMillis());
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/lock", lockResponse);
        }
    }

    /**
     * Block Delete 처리 (v2.0)
     * 블록 삭제
     */
    @MessageMapping("/docs/{docId}/block/delete")
    public void handleBlockDelete(
            @DestinationVariable String docId,
            @Payload Map<String, Object> operation) {

        String blockId = (String) operation.get("blockId");
        String userId = (String) operation.get("userId");
        String clientId = (String) operation.get("clientId");

        logger.debug("Block delete received for doc {}: blockId={}, userId={}", docId, blockId, userId);

        // Check if block is locked by someone else
        DocLockService.LockInfo lockInfo = docLockService.getLockInfo(docId, blockId);
        if (lockInfo != null && !lockInfo.getUserId().equals(userId)) {
            logger.warn("Block delete rejected - locked by another user: blockId={}, lockedBy={}",
                blockId, lockInfo.getUserId());

            Map<String, Object> rejection = new HashMap<>(operation);
            rejection.put("type", "block_delete_rejected");
            rejection.put("reason", "LOCKED_BY_OTHER");
            rejection.put("lockedBy", lockInfo.getUserId());
            rejection.put("lockedByUsername", lockInfo.getUsername());
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/delete", rejection);
            return;
        }

        // Delete from database
        boolean deleted = sessionNoteService.deleteBlock(docId, blockId, userId);

        if (!deleted) {
            Map<String, Object> rejection = new HashMap<>(operation);
            rejection.put("type", "block_delete_rejected");
            rejection.put("reason", "NOT_FOUND");
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/delete", rejection);
            return;
        }

        // Release lock if exists
        if (lockInfo != null) {
            docLockService.releaseLock(docId, blockId, userId, lockInfo.getLockToken());
        }

        // Broadcast to all clients
        Map<String, Object> response = new HashMap<>(operation);
        response.put("type", "block_delete");
        response.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/docs/" + docId + "/block/delete", response);
    }

    /**
     * Convert Block to Map for JSON serialization
     */
    private Map<String, Object> blockToMap(SessionNote.Block block) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", block.getId());
        map.put("type", block.getType());
        map.put("content", block.getContent());
        map.put("createdBy", block.getCreatedBy());
        map.put("createdAt", block.getCreatedAt() != null ? block.getCreatedAt().toString() : null);
        map.put("updatedAt", block.getUpdatedAt() != null ? block.getUpdatedAt().toString() : null);
        map.put("version", block.getVersion());
        map.put("lockedBy", block.getLockedBy());
        map.put("lockToken", block.getLockToken());
        map.put("lockUntil", block.getLockUntil() != null ? block.getLockUntil().toString() : null);
        return map;
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
     * 사용자의 모든 락 자동 해제
     */
    @MessageMapping("/docs/{docId}/leave")
    public void handleLeave(
            @DestinationVariable String docId,
            @Payload Map<String, Object> leaveMessage) {

        String clientId = (String) leaveMessage.get("clientId");
        String userId = (String) leaveMessage.get("userId");

        logger.info("User left doc {}: clientId={}, userId={}", docId, clientId, userId);

        // Remove from presence
        ConcurrentHashMap<String, UserInfo> users = documentUsers.get(docId);
        if (users != null) {
            users.remove(clientId);
            if (users.isEmpty()) {
                documentUsers.remove(docId);
            }
        }

        // Release all locks for this user
        if (userId != null) {
            docLockService.releaseAllLocksForUser(docId, userId);

            // Broadcast lock release to all clients
            Map<String, Object> lockRelease = Map.of(
                "type", "lock_release_all",
                "docId", docId,
                "userId", userId,
                "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSend("/topic/docs/" + docId + "/lock", lockRelease);
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
