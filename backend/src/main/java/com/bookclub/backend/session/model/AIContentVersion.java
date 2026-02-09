package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI Content Version - Stores versioned AI-organized content for a session.
 * Each version is an independent document that can be edited separately.
 * Maximum 5 versions per session (older versions are auto-deleted).
 */
@Document(collection = "ai_content_versions")
@CompoundIndexes({
    @CompoundIndex(name = "session_version_idx", def = "{'sessionId': 1, 'version': 1}", unique = true),
    @CompoundIndex(name = "note_version_idx", def = "{'noteId': 1, 'version': 1}")
})
@Getter
@Setter
@NoArgsConstructor
public class AIContentVersion {

    @Id
    private String id;

    @Indexed
    private String sessionId;

    @Indexed
    private String noteId;  // null이면 공유 세션, 값이면 개인 노트

    private int version;  // 1, 2, 3... (auto-incremented)

    // Block-based content structure (same as SessionNote)
    private List<String> blockOrder;
    private Map<String, SessionNote.Block> blocks;

    // Legacy TipTap JSON content (for initial creation)
    private String aiContent;

    // Metadata
    private LocalDateTime generatedAt;
    private LocalDateTime updatedAt;
    private String generatedBy;      // userId who triggered AI generation
    private String lastEditedBy;     // userId who last edited
    private String modelUsed;        // e.g., "gpt-4o-mini"

    // Validation info (from AI organize)
    private boolean valid;
    private List<String> sourceFragmentIds;
    private List<String> outputFragmentIds;
    private List<String> missingFragments;
    private String validationError;

    /**
     * Create a new AI content version
     */
    public AIContentVersion(String sessionId, int version, String generatedBy, String modelUsed) {
        this.sessionId = sessionId;
        this.version = version;
        this.generatedBy = generatedBy;
        this.modelUsed = modelUsed;
        this.generatedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.blockOrder = new ArrayList<>();
        this.blocks = new HashMap<>();
        this.valid = true;
    }

    /**
     * Generate a unique block ID (same logic as SessionNote)
     */
    public static String generateBlockId() {
        return "blk_" + Long.toString(System.currentTimeMillis(), 36) + "_" +
               Long.toString((long)(Math.random() * 1000000), 36);
    }

    /**
     * Add a block to this version
     */
    public void addBlock(String blockId, SessionNote.Block block) {
        if (blocks == null) {
            blocks = new HashMap<>();
        }
        if (blockOrder == null) {
            blockOrder = new ArrayList<>();
        }
        blocks.put(blockId, block);
        if (!blockOrder.contains(blockId)) {
            blockOrder.add(blockId);
        }
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Get a specific block
     */
    public SessionNote.Block getBlock(String blockId) {
        if (blocks == null) return null;
        return blocks.get(blockId);
    }

    /**
     * Update a block's content
     */
    public boolean updateBlockContent(String blockId, String content, String userId) {
        SessionNote.Block block = getBlock(blockId);
        if (block == null) return false;

        block.setContent(content);
        block.incrementVersion();
        this.lastEditedBy = userId;
        this.updatedAt = LocalDateTime.now();
        return true;
    }

    /**
     * Delete a block
     */
    public boolean deleteBlock(String blockId) {
        if (blocks == null || !blocks.containsKey(blockId)) return false;

        blocks.remove(blockId);
        if (blockOrder != null) {
            blockOrder.remove(blockId);
        }
        this.updatedAt = LocalDateTime.now();
        return true;
    }

    /**
     * Reconstruct full TipTap document from blocks
     */
    public String getContentFromBlocks() {
        if (blocks == null || blocks.isEmpty() || blockOrder == null || blockOrder.isEmpty()) {
            return "{\"type\":\"doc\",\"content\":[]}";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"doc\",\"content\":[");

        boolean first = true;
        for (String blockId : blockOrder) {
            SessionNote.Block block = blocks.get(blockId);
            if (block != null && block.getContent() != null) {
                if (!first) sb.append(",");
                sb.append(block.getContent());
                first = false;
            }
        }

        sb.append("]}");
        return sb.toString();
    }
}
