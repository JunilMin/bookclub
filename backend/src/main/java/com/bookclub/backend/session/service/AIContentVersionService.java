package com.bookclub.backend.session.service;

import com.bookclub.backend.session.model.AIContentVersion;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.repository.AIContentVersionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AIContentVersionService {

    private static final Logger logger = LoggerFactory.getLogger(AIContentVersionService.class);
    private static final int MAX_VERSIONS = 5;

    @Autowired
    private AIContentVersionRepository repository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Create a new AI content version from TipTap JSON content.
     * Automatically assigns the next version number and cleans up old versions.
     */
    @Transactional
    public AIContentVersion createVersion(
            String sessionId,
            String aiContent,
            String userId,
            String modelUsed,
            boolean valid,
            List<String> sourceFragmentIds,
            List<String> outputFragmentIds,
            List<String> missingFragments,
            String validationError) {

        // Get next version number
        int nextVersion = getNextVersionNumber(sessionId);
        logger.info("Creating AI content version {} for session {}", nextVersion, sessionId);

        // Create new version
        AIContentVersion version = new AIContentVersion(sessionId, nextVersion, userId, modelUsed);
        version.setAiContent(aiContent);
        version.setValid(valid);
        version.setSourceFragmentIds(sourceFragmentIds);
        version.setOutputFragmentIds(outputFragmentIds);
        version.setMissingFragments(missingFragments);
        version.setValidationError(validationError);

        // Convert TipTap JSON to blocks
        convertContentToBlocks(version, aiContent, userId);

        // Save
        AIContentVersion saved = repository.save(version);

        // Cleanup old versions (keep only MAX_VERSIONS)
        cleanupOldVersions(sessionId);

        return saved;
    }

    /**
     * Get the next version number for a session
     */
    public int getNextVersionNumber(String sessionId) {
        Optional<AIContentVersion> latest = repository.findFirstBySessionIdOrderByVersionDesc(sessionId);
        return latest.map(v -> v.getVersion() + 1).orElse(1);
    }

    /**
     * Get all versions for a session (summary info only)
     */
    public List<AIContentVersion> getVersions(String sessionId) {
        return repository.findBySessionIdOrderByVersionDesc(sessionId);
    }

    /**
     * Get a specific version
     */
    public Optional<AIContentVersion> getVersion(String sessionId, int version) {
        return repository.findBySessionIdAndVersion(sessionId, version);
    }

    /**
     * Get the latest version
     */
    public Optional<AIContentVersion> getLatestVersion(String sessionId) {
        return repository.findFirstBySessionIdOrderByVersionDesc(sessionId);
    }

    /**
     * Get total version count for a session
     */
    public long getVersionCount(String sessionId) {
        return repository.countBySessionId(sessionId);
    }

    /**
     * Update a block's content in a specific version
     */
    public SessionNote.Block updateBlockContent(
            String sessionId,
            int version,
            String blockId,
            String content,
            String userId) {

        Optional<AIContentVersion> versionOpt = repository.findBySessionIdAndVersion(sessionId, version);
        if (versionOpt.isEmpty()) {
            logger.warn("Version not found: session={}, version={}", sessionId, version);
            return null;
        }

        AIContentVersion ver = versionOpt.get();
        boolean updated = ver.updateBlockContent(blockId, content, userId);
        if (!updated) {
            logger.warn("Block not found: version={}, blockId={}", version, blockId);
            return null;
        }

        repository.save(ver);
        return ver.getBlock(blockId);
    }

    /**
     * Add a new block to a specific version
     */
    public SessionNote.Block addBlock(
            String sessionId,
            int version,
            String type,
            String content,
            String afterBlockId,
            String userId) {

        Optional<AIContentVersion> versionOpt = repository.findBySessionIdAndVersion(sessionId, version);
        if (versionOpt.isEmpty()) {
            logger.warn("Version not found: session={}, version={}", sessionId, version);
            return null;
        }

        AIContentVersion ver = versionOpt.get();

        // Generate new block ID
        String blockId = AIContentVersion.generateBlockId();
        SessionNote.Block block = new SessionNote.Block(blockId, type, content, userId);

        // Add to blocks map
        if (ver.getBlocks() == null) {
            ver.setBlocks(new HashMap<>());
        }
        ver.getBlocks().put(blockId, block);

        // Add to block order
        if (ver.getBlockOrder() == null) {
            ver.setBlockOrder(new ArrayList<>());
        }

        if (afterBlockId == null || !ver.getBlockOrder().contains(afterBlockId)) {
            ver.getBlockOrder().add(blockId);
        } else {
            int index = ver.getBlockOrder().indexOf(afterBlockId);
            ver.getBlockOrder().add(index + 1, blockId);
        }

        ver.setLastEditedBy(userId);
        ver.setUpdatedAt(LocalDateTime.now());
        repository.save(ver);

        return block;
    }

    /**
     * Delete a block from a specific version
     */
    public boolean deleteBlock(String sessionId, int version, String blockId, String userId) {
        Optional<AIContentVersion> versionOpt = repository.findBySessionIdAndVersion(sessionId, version);
        if (versionOpt.isEmpty()) {
            return false;
        }

        AIContentVersion ver = versionOpt.get();
        boolean deleted = ver.deleteBlock(blockId);
        if (deleted) {
            ver.setLastEditedBy(userId);
            repository.save(ver);
        }
        return deleted;
    }

    /**
     * Update block order for a specific version
     */
    public AIContentVersion updateBlockOrder(
            String sessionId,
            int version,
            List<String> blockOrder,
            String userId) {

        Optional<AIContentVersion> versionOpt = repository.findBySessionIdAndVersion(sessionId, version);
        if (versionOpt.isEmpty()) {
            return null;
        }

        AIContentVersion ver = versionOpt.get();
        ver.setBlockOrder(blockOrder);
        ver.setLastEditedBy(userId);
        ver.setUpdatedAt(LocalDateTime.now());

        return repository.save(ver);
    }

    /**
     * Clean up old versions, keeping only the most recent MAX_VERSIONS
     */
    @Transactional
    public void cleanupOldVersions(String sessionId) {
        long count = repository.countBySessionId(sessionId);
        if (count <= MAX_VERSIONS) {
            return;
        }

        // Get all versions ordered by version ascending
        List<AIContentVersion> versions = repository.findBySessionIdOrderByVersionAsc(sessionId);

        // Delete oldest versions to keep only MAX_VERSIONS
        int toDelete = (int) (count - MAX_VERSIONS);
        for (int i = 0; i < toDelete && i < versions.size(); i++) {
            AIContentVersion ver = versions.get(i);
            logger.info("Deleting old AI content version: session={}, version={}", sessionId, ver.getVersion());
            repository.delete(ver);
        }
    }

    /**
     * Convert TipTap JSON content to block format
     */
    private void convertContentToBlocks(AIContentVersion version, String aiContent, String userId) {
        try {
            JsonNode root = objectMapper.readTree(aiContent);
            JsonNode contentArray = root.get("content");

            if (contentArray == null || !contentArray.isArray()) {
                logger.warn("Invalid TipTap content: missing content array");
                return;
            }

            List<String> blockOrder = new ArrayList<>();
            Map<String, SessionNote.Block> blocks = new HashMap<>();

            for (JsonNode node : contentArray) {
                String blockId = AIContentVersion.generateBlockId();
                String type = node.has("type") ? node.get("type").asText() : "paragraph";
                String blockContent = objectMapper.writeValueAsString(node);

                SessionNote.Block block = new SessionNote.Block(blockId, type, blockContent, userId);
                blocks.put(blockId, block);
                blockOrder.add(blockId);
            }

            version.setBlockOrder(blockOrder);
            version.setBlocks(blocks);

            logger.info("Converted AI content to {} blocks for version {}", blocks.size(), version.getVersion());

        } catch (Exception e) {
            logger.error("Failed to convert AI content to blocks: {}", e.getMessage());
        }
    }
}
