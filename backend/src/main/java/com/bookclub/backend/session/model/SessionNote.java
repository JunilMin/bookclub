package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;

@Document(collection = "session_notes")
@Getter
@Setter
@NoArgsConstructor
public class SessionNote {
    @Id
    private String id;

    private String sessionId;

    private String title;  // Note title (default: "{bookTitle} 북클럽" or "{bookTitle} Book Club")

    /**
     * @deprecated Use blocks map instead. Kept for backward compatibility during migration.
     */
    @Deprecated
    private String content;  // TipTap JSON content (Free Notes) - LEGACY

    private String aiContent;  // TipTap JSON content (AI Organized Notes)

    private LocalDateTime aiContentGeneratedAt;  // When AI content was generated

    private int version;  // For conflict resolution

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String lastEditedById;  // User ObjectId of last editor

    // === Block-based Architecture (v2.0) ===
    private boolean migrated;  // Whether document has been migrated to block format

    private List<String> blockOrder;  // SSOT: Ordered list of block IDs

    private Map<String, Block> blocks;  // Block ID -> Block (content + metadata)

    /**
     * Block - Atomic unit of collaborative editing
     * Contains both content and metadata for a single block
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Block {
        private String id;           // Unique block ID
        private String type;         // Block type: paragraph, heading, bulletList, orderedList, blockquote, codeBlock, taskList, utteranceBlock
        private String content;      // TipTap JSON content for this block (single node)

        // Metadata
        private String createdBy;    // User ID who created this block
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private int version;         // Block-level version for conflict detection

        // Lock information (for concurrent editing)
        private String lockedBy;     // User ID who has the lock
        private String lockToken;    // Unique token for lock validation
        private LocalDateTime lockUntil;  // Lock expiration time (TTL-based)

        /**
         * Create a new block with content
         */
        public Block(String id, String type, String content, String createdBy) {
            this.id = id;
            this.type = type;
            this.content = content;
            this.createdBy = createdBy;
            this.createdAt = LocalDateTime.now();
            this.updatedAt = LocalDateTime.now();
            this.version = 1;
        }

        /**
         * Check if this block is currently locked
         */
        public boolean isLocked() {
            if (lockedBy == null || lockUntil == null) return false;
            return LocalDateTime.now().isBefore(lockUntil);
        }

        /**
         * Check if this block is locked by a specific user
         */
        public boolean isLockedBy(String userId) {
            return isLocked() && lockedBy.equals(userId);
        }

        /**
         * Increment version and update timestamp
         */
        public void incrementVersion() {
            this.version++;
            this.updatedAt = LocalDateTime.now();
        }
    }

    /**
     * @deprecated Use Block instead. Kept for backward compatibility.
     */
    @Deprecated
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockMeta {
        private String id;
        private String type;
        private String createdBy;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private String lockedBy;
        private String lockToken;
        private LocalDateTime lockUntil;

        public BlockMeta(String id, String type, String createdBy) {
            this.id = id;
            this.type = type;
            this.createdBy = createdBy;
            this.createdAt = LocalDateTime.now();
            this.updatedAt = LocalDateTime.now();
        }

        public boolean isLocked() {
            if (lockedBy == null || lockUntil == null) return false;
            return LocalDateTime.now().isBefore(lockUntil);
        }

        public boolean isLockedBy(String userId) {
            return isLocked() && lockedBy.equals(userId);
        }
    }

    public SessionNote(String sessionId) {
        this.sessionId = sessionId;
        this.title = "Discussion Notes";  // Default title (will be updated with book name)
        this.version = 1;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.migrated = true;  // New documents start in block format
        this.blockOrder = new ArrayList<>();
        this.blocks = new HashMap<>();
        initializeDefaultBlocks();
    }

    public SessionNote(String sessionId, String title) {
        this.sessionId = sessionId;
        this.title = title;  // Use provided title (e.g., "[2026-01-13] Clean Code")
        this.version = 1;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.migrated = true;  // New documents start in block format
        this.blockOrder = new ArrayList<>();
        this.blocks = new HashMap<>();
        initializeDefaultBlocks();
    }

    /**
     * Initialize document with default blocks
     */
    private void initializeDefaultBlocks() {
        // Block 1: Title heading
        String block1Id = generateBlockId();
        blockOrder.add(block1Id);
        blocks.put(block1Id, new Block(
            block1Id,
            "heading",
            "{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"Discussion Notes\"}]}",
            null
        ));

        // Block 2: Main Topics heading
        String block2Id = generateBlockId();
        blockOrder.add(block2Id);
        blocks.put(block2Id, new Block(
            block2Id,
            "heading",
            "{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":[{\"type\":\"text\",\"text\":\"Main Topics\"}]}",
            null
        ));

        // Block 3: Bullet list
        String block3Id = generateBlockId();
        blockOrder.add(block3Id);
        blocks.put(block3Id, new Block(
            block3Id,
            "bulletList",
            "{\"type\":\"bulletList\",\"content\":[{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Add your discussion points here...\"}]}]}]}",
            null
        ));

        // Block 4: Key Quotes heading
        String block4Id = generateBlockId();
        blockOrder.add(block4Id);
        blocks.put(block4Id, new Block(
            block4Id,
            "heading",
            "{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":[{\"type\":\"text\",\"text\":\"Key Quotes\"}]}",
            null
        ));

        // Block 5: Blockquote
        String block5Id = generateBlockId();
        blockOrder.add(block5Id);
        blocks.put(block5Id, new Block(
            block5Id,
            "blockquote",
            "{\"type\":\"blockquote\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Add memorable quotes here...\"}]}]}",
            null
        ));

        // Block 6: Open Questions heading
        String block6Id = generateBlockId();
        blockOrder.add(block6Id);
        blocks.put(block6Id, new Block(
            block6Id,
            "heading",
            "{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":[{\"type\":\"text\",\"text\":\"Open Questions\"}]}",
            null
        ));

        // Block 7: Task list
        String block7Id = generateBlockId();
        blockOrder.add(block7Id);
        blocks.put(block7Id, new Block(
            block7Id,
            "taskList",
            "{\"type\":\"taskList\",\"content\":[{\"type\":\"taskItem\",\"attrs\":{\"checked\":false},\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Questions to explore...\"}]}]}]}",
            null
        ));
    }

    /**
     * Generate a unique block ID
     */
    public static String generateBlockId() {
        return "blk_" + Long.toString(System.currentTimeMillis(), 36) + "_" +
               Long.toString((long)(Math.random() * 1000000), 36);
    }

    /**
     * @deprecated Use blocks instead. Kept for backward compatibility during migration.
     */
    @Deprecated
    private String getDefaultContent() {
        return """
            {
                "type": "doc",
                "content": [
                    {
                        "type": "heading",
                        "attrs": { "level": 1 },
                        "content": [{ "type": "text", "text": "Discussion Notes" }]
                    },
                    {
                        "type": "paragraph",
                        "content": [{ "type": "text", "text": "Start taking notes..." }]
                    }
                ]
            }
            """;
    }

    /**
     * Reconstruct full TipTap document from blocks (for legacy API compatibility)
     */
    public String getContentFromBlocks() {
        if (blocks == null || blocks.isEmpty() || blockOrder == null || blockOrder.isEmpty()) {
            return getDefaultContent();
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"doc\",\"content\":[");

        boolean first = true;
        for (String blockId : blockOrder) {
            Block block = blocks.get(blockId);
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
