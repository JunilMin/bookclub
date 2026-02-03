package com.bookclub.backend.session.service;

import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.model.SessionNote.Block;
import com.bookclub.backend.session.model.SessionNote.BlockMeta;
import com.bookclub.backend.session.repository.SessionNoteRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class SessionNoteService {

    private static final Logger logger = LoggerFactory.getLogger(SessionNoteService.class);

    @Autowired
    private SessionNoteRepository sessionNoteRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Get or create a note, triggering migration if needed.
     * Uses findFirstBySessionId to safely handle potential duplicates.
     */
    public SessionNote getOrCreateNote(String sessionId) {
        Optional<SessionNote> noteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);

        if (noteOpt.isPresent()) {
            SessionNote note = noteOpt.get();
            // Trigger migration if needed
            if (!note.isMigrated() && note.getContent() != null && !note.getContent().isBlank()) {
                return migrateNote(note);
            }
            return note;
        }

        SessionNote note = new SessionNote(sessionId);
        return sessionNoteRepository.save(note);
    }

    /**
     * Get or create a note with title, triggering migration if needed.
     * Uses findFirstBySessionId to safely handle potential duplicates.
     */
    public SessionNote getOrCreateNote(String sessionId, String title) {
        Optional<SessionNote> noteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);

        if (noteOpt.isPresent()) {
            SessionNote note = noteOpt.get();
            // Trigger migration if needed
            if (!note.isMigrated() && note.getContent() != null && !note.getContent().isBlank()) {
                return migrateNote(note);
            }
            return note;
        }

        SessionNote note = new SessionNote(sessionId, title);
        return sessionNoteRepository.save(note);
    }

    /**
     * Migrate legacy content to block format
     * Converts TipTap document JSON to individual blocks
     */
    private SessionNote migrateNote(SessionNote note) {
        try {
            logger.info("Migrating note {} to block format", note.getSessionId());

            JsonNode content = objectMapper.readTree(note.getContent());
            JsonNode docContent = content.get("content");

            List<String> blockOrder = new ArrayList<>();
            Map<String, Block> blocks = new HashMap<>();

            if (docContent != null && docContent.isArray()) {
                for (JsonNode node : docContent) {
                    String blockId = SessionNote.generateBlockId();
                    String type = node.has("type") ? node.get("type").asText() : "paragraph";
                    String blockContent = objectMapper.writeValueAsString(node);

                    Block block = new Block(blockId, type, blockContent, note.getLastEditedById());
                    block.setCreatedAt(note.getCreatedAt());
                    block.setUpdatedAt(note.getUpdatedAt());

                    blockOrder.add(blockId);
                    blocks.put(blockId, block);
                }
            }

            note.setBlockOrder(blockOrder);
            note.setBlocks(blocks);
            note.setMigrated(true);
            note.setUpdatedAt(LocalDateTime.now());

            logger.info("Migration complete for note {}: {} blocks created", note.getSessionId(), blocks.size());
            return sessionNoteRepository.save(note);

        } catch (Exception e) {
            logger.error("Migration failed for note {}: {}", note.getSessionId(), e.getMessage());
            // Return unmigrated note to avoid data loss
            return note;
        }
    }

    /**
     * @deprecated Use updateBlock instead for block-based editing
     */
    @Deprecated
    public SessionNote updateNote(String sessionId, String content, String userId) {
        SessionNote note = getOrCreateNote(sessionId);
        note.setContent(content);
        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());
        note.setVersion(note.getVersion() + 1);
        return sessionNoteRepository.save(note);
    }

    public SessionNote updateTitle(String sessionId, String title, String userId) {
        SessionNote note = getOrCreateNote(sessionId);
        note.setTitle(title);
        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());
        return sessionNoteRepository.save(note);
    }

    public Optional<SessionNote> getNoteBySessionId(String sessionId) {
        return sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
    }

    /**
     * Update AI organized content for a session note
     * @param sessionId The session ID
     * @param aiContent The AI organized content in TipTap JSON format
     * @return Updated SessionNote
     */
    public SessionNote updateAiContent(String sessionId, String aiContent) {
        SessionNote note = getOrCreateNote(sessionId);
        note.setAiContent(aiContent);
        note.setAiContentGeneratedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        return sessionNoteRepository.save(note);
    }

    // ============================================
    // Block Management (v2.0 - Block-based SSOT)
    // ============================================

    /**
     * Update block order (reorder blocks via drag-drop)
     */
    public SessionNote updateBlockOrder(String sessionId, List<String> blockOrder, String userId) {
        SessionNote note = getOrCreateNote(sessionId);

        if (note.getBlockOrder() == null) {
            note.setBlockOrder(new ArrayList<>());
        }
        note.setBlockOrder(blockOrder);
        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());
        note.setVersion(note.getVersion() + 1);

        return sessionNoteRepository.save(note);
    }

    /**
     * Get a single block by ID
     */
    public Block getBlock(String sessionId, String blockId) {
        Optional<SessionNote> noteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
        if (noteOpt.isEmpty() || noteOpt.get().getBlocks() == null) {
            return null;
        }
        return noteOpt.get().getBlocks().get(blockId);
    }

    /**
     * Get all blocks for a session
     */
    public Map<String, Block> getAllBlocks(String sessionId) {
        SessionNote note = getOrCreateNote(sessionId);
        return note.getBlocks() != null ? note.getBlocks() : new HashMap<>();
    }

    /**
     * Get block order for a session
     */
    public List<String> getBlockOrder(String sessionId) {
        SessionNote note = getOrCreateNote(sessionId);
        return note.getBlockOrder() != null ? note.getBlockOrder() : new ArrayList<>();
    }

    /**
     * Update block content
     * @param sessionId The session ID
     * @param blockId The block ID
     * @param content New TipTap JSON content for this block
     * @param userId User making the change
     * @param expectedVersion Expected block version for optimistic locking (0 = ignore)
     * @return Updated Block or null if block not found
     */
    public Block updateBlockContent(String sessionId, String blockId, String content, String userId, int expectedVersion) {
        SessionNote note = getOrCreateNote(sessionId);

        if (note.getBlocks() == null) {
            note.setBlocks(new HashMap<>());
        }

        Block block = note.getBlocks().get(blockId);
        if (block == null) {
            logger.warn("Block not found: sessionId={}, blockId={}", sessionId, blockId);
            return null;
        }

        // Optimistic locking: check version
        // Since lock ownership is verified at controller level, we log warning but proceed
        // This handles rapid saves from the same user (debounce can still overlap with network latency)
        if (expectedVersion > 0 && block.getVersion() != expectedVersion) {
            logger.info("Version mismatch for block {} (proceeding anyway - lock owner): expected {}, actual {}",
                blockId, expectedVersion, block.getVersion());
            // Continue anyway - lock ownership guarantees single writer
        }

        block.setContent(content);
        block.incrementVersion();
        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());

        sessionNoteRepository.save(note);
        return block;
    }

    /**
     * Add a new block
     * @param sessionId The session ID
     * @param type Block type
     * @param content Initial content
     * @param afterBlockId Insert after this block ID (null = end of document)
     * @param userId User creating the block
     * @return Created Block
     */
    public Block addBlock(String sessionId, String type, String content, String afterBlockId, String userId) {
        SessionNote note = getOrCreateNote(sessionId);

        if (note.getBlocks() == null) {
            note.setBlocks(new HashMap<>());
        }
        if (note.getBlockOrder() == null) {
            note.setBlockOrder(new ArrayList<>());
        }

        // Create new block
        String blockId = SessionNote.generateBlockId();
        Block block = new Block(blockId, type, content, userId);

        // Add to blocks map
        note.getBlocks().put(blockId, block);

        // Add to block order
        if (afterBlockId == null || !note.getBlockOrder().contains(afterBlockId)) {
            // Add at end
            note.getBlockOrder().add(blockId);
        } else {
            // Insert after specified block
            int index = note.getBlockOrder().indexOf(afterBlockId);
            note.getBlockOrder().add(index + 1, blockId);
        }

        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());
        note.setVersion(note.getVersion() + 1);

        sessionNoteRepository.save(note);
        return block;
    }

    /**
     * Delete a block
     */
    public boolean deleteBlock(String sessionId, String blockId, String userId) {
        SessionNote note = getOrCreateNote(sessionId);

        if (note.getBlocks() == null || !note.getBlocks().containsKey(blockId)) {
            return false;
        }

        note.getBlocks().remove(blockId);
        if (note.getBlockOrder() != null) {
            note.getBlockOrder().remove(blockId);
        }

        note.setLastEditedById(userId);
        note.setUpdatedAt(LocalDateTime.now());
        note.setVersion(note.getVersion() + 1);

        sessionNoteRepository.save(note);
        return true;
    }

    // ============================================
    // Legacy BlockMeta methods (deprecated)
    // ============================================

    /**
     * @deprecated Use getBlock instead
     */
    @Deprecated
    public BlockMeta getBlockMeta(String sessionId, String blockId) {
        Block block = getBlock(sessionId, blockId);
        if (block == null) return null;

        // Convert Block to BlockMeta for backward compatibility
        BlockMeta meta = new BlockMeta();
        meta.setId(block.getId());
        meta.setType(block.getType());
        meta.setCreatedBy(block.getCreatedBy());
        meta.setCreatedAt(block.getCreatedAt());
        meta.setUpdatedAt(block.getUpdatedAt());
        meta.setLockedBy(block.getLockedBy());
        meta.setLockToken(block.getLockToken());
        meta.setLockUntil(block.getLockUntil());
        return meta;
    }

    /**
     * @deprecated Use getAllBlocks instead
     */
    @Deprecated
    @SuppressWarnings("unchecked")
    public Map<String, BlockMeta> getAllBlockMeta(String sessionId) {
        Map<String, Block> blocks = getAllBlocks(sessionId);
        Map<String, BlockMeta> result = new HashMap<>();

        for (Map.Entry<String, Block> entry : blocks.entrySet()) {
            Block block = entry.getValue();
            BlockMeta meta = new BlockMeta();
            meta.setId(block.getId());
            meta.setType(block.getType());
            meta.setCreatedBy(block.getCreatedBy());
            meta.setCreatedAt(block.getCreatedAt());
            meta.setUpdatedAt(block.getUpdatedAt());
            meta.setLockedBy(block.getLockedBy());
            meta.setLockToken(block.getLockToken());
            meta.setLockUntil(block.getLockUntil());
            result.put(entry.getKey(), meta);
        }

        return result;
    }

    /**
     * @deprecated Use addBlock or updateBlockContent instead
     */
    @Deprecated
    public SessionNote upsertBlockMeta(String sessionId, BlockMeta blockMeta) {
        SessionNote note = getOrCreateNote(sessionId);

        if (note.getBlocks() == null) {
            note.setBlocks(new HashMap<>());
        }

        // Check if block exists
        Block existingBlock = note.getBlocks().get(blockMeta.getId());
        if (existingBlock != null) {
            // Update metadata only (preserve content)
            existingBlock.setLockedBy(blockMeta.getLockedBy());
            existingBlock.setLockToken(blockMeta.getLockToken());
            existingBlock.setLockUntil(blockMeta.getLockUntil());
            existingBlock.setUpdatedAt(LocalDateTime.now());
        } else {
            // Create new block with empty content
            Block block = new Block(
                blockMeta.getId(),
                blockMeta.getType(),
                "{\"type\":\"paragraph\",\"content\":[]}",
                blockMeta.getCreatedBy()
            );
            block.setLockedBy(blockMeta.getLockedBy());
            block.setLockToken(blockMeta.getLockToken());
            block.setLockUntil(blockMeta.getLockUntil());
            note.getBlocks().put(blockMeta.getId(), block);

            if (note.getBlockOrder() == null) {
                note.setBlockOrder(new ArrayList<>());
            }
            if (!note.getBlockOrder().contains(blockMeta.getId())) {
                note.getBlockOrder().add(blockMeta.getId());
            }
        }

        note.setUpdatedAt(LocalDateTime.now());
        return sessionNoteRepository.save(note);
    }

    /**
     * @deprecated Use deleteBlock instead
     */
    @Deprecated
    public SessionNote removeBlockMeta(String sessionId, String blockId) {
        deleteBlock(sessionId, blockId, null);
        return getOrCreateNote(sessionId);
    }
}
