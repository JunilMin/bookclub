package com.bookclub.backend.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * DocLockService - Block-level Lock Management
 *
 * Provides lease-based locking for collaborative editing blocks.
 * Features:
 * - TTL-based locks (15 seconds default)
 * - Automatic expiration cleanup
 * - Lock renewal support
 * - Conflict detection
 *
 * MVP: In-memory storage (stateless on restart)
 * TODO: Persist to Redis/MongoDB for HA
 */
@Service
public class DocLockService {

    private static final Logger logger = LoggerFactory.getLogger(DocLockService.class);

    // Default lock TTL in milliseconds (15 seconds)
    private static final long DEFAULT_LOCK_TTL_MS = 15000;

    // Lock storage: docId -> blockId -> LockInfo
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, LockInfo>> locks = new ConcurrentHashMap<>();

    /**
     * Lock information
     */
    public static class LockInfo {
        private final String userId;
        private final String username;
        private final String clientId;
        private final String lockToken;
        private long lockUntil;

        public LockInfo(String userId, String username, String clientId, String lockToken, long lockUntil) {
            this.userId = userId;
            this.username = username;
            this.clientId = clientId;
            this.lockToken = lockToken;
            this.lockUntil = lockUntil;
        }

        public String getUserId() { return userId; }
        public String getUsername() { return username; }
        public String getClientId() { return clientId; }
        public String getLockToken() { return lockToken; }
        public long getLockUntil() { return lockUntil; }

        public boolean isExpired() {
            return System.currentTimeMillis() > lockUntil;
        }

        public void renew(long newLockUntil) {
            this.lockUntil = newLockUntil;
        }

        public Map<String, Object> toMap() {
            return Map.of(
                "userId", userId,
                "username", username,
                "clientId", clientId,
                "lockToken", lockToken,
                "lockUntil", lockUntil
            );
        }
    }

    /**
     * Lock result
     */
    public static class LockResult {
        private final boolean success;
        private final LockInfo lockInfo;
        private final String reason;

        private LockResult(boolean success, LockInfo lockInfo, String reason) {
            this.success = success;
            this.lockInfo = lockInfo;
            this.reason = reason;
        }

        public static LockResult success(LockInfo lockInfo) {
            return new LockResult(true, lockInfo, null);
        }

        public static LockResult failure(String reason, LockInfo existingLock) {
            return new LockResult(false, existingLock, reason);
        }

        public boolean isSuccess() { return success; }
        public LockInfo getLockInfo() { return lockInfo; }
        public String getReason() { return reason; }
    }

    /**
     * Request a lock on a block
     */
    public LockResult requestLock(String docId, String blockId, String userId, String username, String clientId) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.computeIfAbsent(docId, k -> new ConcurrentHashMap<>());

        // Check existing lock
        LockInfo existing = docLocks.get(blockId);
        if (existing != null && !existing.isExpired()) {
            // Already locked by someone else
            if (!existing.getUserId().equals(userId)) {
                logger.debug("Lock denied for block {}: already locked by {}", blockId, existing.getUsername());
                return LockResult.failure("Block is locked by " + existing.getUsername(), existing);
            }
            // Same user - renew the lock
            existing.renew(System.currentTimeMillis() + DEFAULT_LOCK_TTL_MS);
            logger.debug("Lock renewed for block {} by {}", blockId, username);
            return LockResult.success(existing);
        }

        // Create new lock
        String lockToken = generateLockToken();
        long lockUntil = System.currentTimeMillis() + DEFAULT_LOCK_TTL_MS;
        LockInfo newLock = new LockInfo(userId, username, clientId, lockToken, lockUntil);

        docLocks.put(blockId, newLock);
        logger.info("Lock acquired for block {} by {} (expires: {})", blockId, username, lockUntil);

        return LockResult.success(newLock);
    }

    /**
     * Renew an existing lock
     */
    public LockResult renewLock(String docId, String blockId, String userId, String lockToken) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.get(docId);
        if (docLocks == null) {
            return LockResult.failure("No locks for document", null);
        }

        LockInfo existing = docLocks.get(blockId);
        if (existing == null) {
            return LockResult.failure("Lock not found", null);
        }

        // Validate ownership
        if (!existing.getUserId().equals(userId) || !existing.getLockToken().equals(lockToken)) {
            return LockResult.failure("Lock token mismatch", existing);
        }

        // Renew
        existing.renew(System.currentTimeMillis() + DEFAULT_LOCK_TTL_MS);
        logger.debug("Lock renewed for block {} (new expiry: {})", blockId, existing.getLockUntil());

        return LockResult.success(existing);
    }

    /**
     * Release a lock
     */
    public boolean releaseLock(String docId, String blockId, String userId, String lockToken) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.get(docId);
        if (docLocks == null) {
            return false;
        }

        LockInfo existing = docLocks.get(blockId);
        if (existing == null) {
            return false;
        }

        // Validate ownership (or expired)
        if (existing.isExpired() ||
            (existing.getUserId().equals(userId) && existing.getLockToken().equals(lockToken))) {
            docLocks.remove(blockId);
            logger.info("Lock released for block {} by {}", blockId, userId);

            // Cleanup empty doc map
            if (docLocks.isEmpty()) {
                locks.remove(docId);
            }
            return true;
        }

        logger.warn("Lock release denied for block {}: ownership mismatch", blockId);
        return false;
    }

    /**
     * Release all locks for a user (on disconnect)
     */
    public void releaseAllLocksForUser(String docId, String userId) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.get(docId);
        if (docLocks == null) return;

        docLocks.entrySet().removeIf(entry -> {
            boolean shouldRemove = entry.getValue().getUserId().equals(userId);
            if (shouldRemove) {
                logger.info("Auto-released lock for block {} (user {} disconnected)", entry.getKey(), userId);
            }
            return shouldRemove;
        });

        if (docLocks.isEmpty()) {
            locks.remove(docId);
        }
    }

    /**
     * Get current lock info for a block
     */
    public LockInfo getLockInfo(String docId, String blockId) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.get(docId);
        if (docLocks == null) return null;

        LockInfo lock = docLocks.get(blockId);
        if (lock != null && lock.isExpired()) {
            docLocks.remove(blockId);
            return null;
        }
        return lock;
    }

    /**
     * Get all locks for a document
     */
    public Map<String, LockInfo> getAllLocks(String docId) {
        ConcurrentHashMap<String, LockInfo> docLocks = locks.get(docId);
        if (docLocks == null) return Map.of();

        // Filter out expired locks
        docLocks.entrySet().removeIf(e -> e.getValue().isExpired());
        return Map.copyOf(docLocks);
    }

    /**
     * Cleanup expired locks (runs every 5 seconds)
     */
    @Scheduled(fixedRate = 5000)
    public void cleanupExpiredLocks() {
        locks.forEach((docId, docLocks) -> {
            int before = docLocks.size();
            docLocks.entrySet().removeIf(e -> e.getValue().isExpired());
            int removed = before - docLocks.size();
            if (removed > 0) {
                logger.debug("Cleaned up {} expired locks for doc {}", removed, docId);
            }

            if (docLocks.isEmpty()) {
                locks.remove(docId);
            }
        });
    }

    /**
     * Generate a unique lock token
     */
    private String generateLockToken() {
        return "lock_" + UUID.randomUUID().toString().substring(0, 8);
    }
}
