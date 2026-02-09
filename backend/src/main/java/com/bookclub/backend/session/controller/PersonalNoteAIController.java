package com.bookclub.backend.session.controller;

import com.bookclub.backend.openai.OpenAIService;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.AIContentVersion;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AIOrganizedContent;
import com.bookclub.backend.session.model.UserSessionNote;
import com.bookclub.backend.session.repository.UserSessionNoteRepository;
import com.bookclub.backend.session.service.AIContentVersionService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user-notes")
@CrossOrigin(origins = "http://localhost:5173")
public class PersonalNoteAIController {

    private static final Logger logger = LoggerFactory.getLogger(PersonalNoteAIController.class);

    @Autowired
    private OpenAIService openAIService;

    @Autowired
    private AIContentVersionService aiContentVersionService;

    @Autowired
    private UserSessionNoteRepository userSessionNoteRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Generate AI summary from personal note content
     * POST /api/user-notes/{noteId}/ai-summary
     */
    @PostMapping("/{noteId}/ai-summary")
    public ResponseEntity<?> generatePersonalAISummary(
            @PathVariable String noteId,
            @RequestParam(defaultValue = "en") String language,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            // Get and verify ownership
            Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            UserSessionNote note = noteOpt.get();
            if (!note.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            // Get book title from session → post chain
            String bookTitle = getBookTitleFromNote(note);

            // Use personal note content as source
            String noteContent = note.getContent() != null ? note.getContent() : "";

            // Generate summary
            AISummary summary = openAIService.generateSummary(bookTitle, noteContent, language);

            // Save to personal note (not shared recording)
            note.setPersonalAiSummary(summary);
            userSessionNoteRepository.save(note);

            // Return the summary in a recording-like wrapper for frontend compatibility
            Map<String, Object> response = new HashMap<>();
            response.put("personalAiSummary", summary);
            response.put("noteId", noteId);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to generate personal AI summary for note {}: {}", noteId, e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to generate AI summary: " + e.getMessage()));
        }
    }

    /**
     * Organize personal note content using AI
     * POST /api/user-notes/{noteId}/ai-organize
     */
    @PostMapping("/{noteId}/ai-organize")
    public ResponseEntity<?> organizePersonalNotes(
            @PathVariable String noteId,
            @RequestParam(defaultValue = "en") String language,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            // Get and verify ownership
            Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            UserSessionNote note = noteOpt.get();
            if (!note.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            // Get book title
            String bookTitle = getBookTitleFromNote(note);

            // Use personal note content
            String noteContent = note.getContent() != null ? note.getContent() : "";

            // Organize with AI
            AIOrganizedContent organizedContent = openAIService.organizeNotes(bookTitle, noteContent, language);

            // Convert to TipTap JSON
            String aiContentJson = convertToTipTapJson(organizedContent.getOrganizedText(), language);

            // Save as personal AI content version (noteId-based)
            AIContentVersion newVersion = aiContentVersionService.createPersonalVersion(
                noteId,
                note.getSessionId(),
                aiContentJson,
                userId,
                organizedContent.getModelUsed() != null ? organizedContent.getModelUsed() : "gpt-4o-mini",
                organizedContent.isValid(),
                organizedContent.getSourceFragmentIds(),
                organizedContent.getOutputFragmentIds(),
                organizedContent.getMissingFragments(),
                organizedContent.getValidationError()
            );

            // Get total version count
            long totalVersions = aiContentVersionService.getPersonalVersionCount(noteId);

            // Return version info
            Map<String, Object> response = new HashMap<>();
            response.put("version", newVersion.getVersion());
            response.put("totalVersions", totalVersions);
            response.put("versionId", newVersion.getId());
            response.put("generatedAt", newVersion.getGeneratedAt());
            response.put("blockOrder", newVersion.getBlockOrder());
            response.put("blocks", newVersion.getBlocks());
            response.put("validation", Map.of(
                "valid", organizedContent.isValid(),
                "sourceFragmentIds", organizedContent.getSourceFragmentIds() != null ? organizedContent.getSourceFragmentIds() : List.of(),
                "outputFragmentIds", organizedContent.getOutputFragmentIds() != null ? organizedContent.getOutputFragmentIds() : List.of(),
                "missingFragments", organizedContent.getMissingFragments() != null ? organizedContent.getMissingFragments() : List.of(),
                "validationError", organizedContent.getValidationError() != null ? organizedContent.getValidationError() : ""
            ));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to organize personal notes for note {}: {}", noteId, e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to organize notes: " + e.getMessage()));
        }
    }

    /**
     * Get all AI content versions for a personal note
     * GET /api/user-notes/{noteId}/ai-versions
     */
    @GetMapping("/{noteId}/ai-versions")
    public ResponseEntity<?> getPersonalAiVersions(
            @PathVariable String noteId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            // Verify ownership
            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            List<AIContentVersion> versions = aiContentVersionService.getPersonalVersions(noteId);

            List<Map<String, Object>> summaries = versions.stream()
                .map(v -> {
                    Map<String, Object> summary = new HashMap<>();
                    summary.put("version", v.getVersion());
                    summary.put("generatedAt", v.getGeneratedAt());
                    summary.put("updatedAt", v.getUpdatedAt());
                    summary.put("generatedBy", v.getGeneratedBy());
                    summary.put("valid", v.isValid());
                    return summary;
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                "versions", summaries,
                "totalVersions", versions.size()
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get AI versions: " + e.getMessage()));
        }
    }

    /**
     * Get a specific AI content version for a personal note
     * GET /api/user-notes/{noteId}/ai-versions/{version}
     */
    @GetMapping("/{noteId}/ai-versions/{version}")
    public ResponseEntity<?> getPersonalAiVersion(
            @PathVariable String noteId,
            @PathVariable int version,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            Optional<AIContentVersion> versionOpt = aiContentVersionService.getPersonalVersion(noteId, version);
            if (versionOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            AIContentVersion ver = versionOpt.get();

            Map<String, Object> response = new HashMap<>();
            response.put("id", ver.getId());
            response.put("noteId", ver.getNoteId());
            response.put("sessionId", ver.getSessionId());
            response.put("version", ver.getVersion());
            response.put("blockOrder", ver.getBlockOrder());
            response.put("blocks", ver.getBlocks());
            response.put("generatedAt", ver.getGeneratedAt());
            response.put("updatedAt", ver.getUpdatedAt());
            response.put("generatedBy", ver.getGeneratedBy());
            response.put("lastEditedBy", ver.getLastEditedBy());
            response.put("valid", ver.isValid());
            response.put("missingFragments", ver.getMissingFragments());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get AI version: " + e.getMessage()));
        }
    }

    /**
     * Update a block's content in a personal AI version
     * PUT /api/user-notes/{noteId}/ai-versions/{version}/blocks/{blockId}/content
     */
    @PutMapping("/{noteId}/ai-versions/{version}/blocks/{blockId}/content")
    public ResponseEntity<?> updatePersonalAiVersionBlockContent(
            @PathVariable String noteId,
            @PathVariable int version,
            @PathVariable String blockId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            String content = (String) payload.get("content");
            if (content == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "content is required"));
            }

            SessionNote.Block block = aiContentVersionService.updatePersonalBlockContent(
                noteId, version, blockId, content, userId
            );

            if (block == null) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok(block);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to update block: " + e.getMessage()));
        }
    }

    /**
     * Add a new block to a personal AI version
     * POST /api/user-notes/{noteId}/ai-versions/{version}/blocks
     */
    @PostMapping("/{noteId}/ai-versions/{version}/blocks")
    public ResponseEntity<?> addPersonalAiVersionBlock(
            @PathVariable String noteId,
            @PathVariable int version,
            @RequestBody Map<String, String> payload,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            String type = payload.get("type");
            String content = payload.get("content");
            String afterBlockId = payload.get("afterBlockId");

            if (type == null || content == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "type and content are required"));
            }

            SessionNote.Block block = aiContentVersionService.addPersonalBlock(
                noteId, version, type, content, afterBlockId, userId
            );

            if (block == null) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.status(201).body(block);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to add block: " + e.getMessage()));
        }
    }

    /**
     * Delete a block from a personal AI version
     * DELETE /api/user-notes/{noteId}/ai-versions/{version}/blocks/{blockId}
     */
    @DeleteMapping("/{noteId}/ai-versions/{version}/blocks/{blockId}")
    public ResponseEntity<?> deletePersonalAiVersionBlock(
            @PathVariable String noteId,
            @PathVariable int version,
            @PathVariable String blockId,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            boolean deleted = aiContentVersionService.deletePersonalBlock(noteId, version, blockId, userId);

            if (!deleted) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok(Map.of("success", true, "blockId", blockId));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to delete block: " + e.getMessage()));
        }
    }

    // ============================================
    // Import shared AI version as personal
    // ============================================

    @PostMapping("/{noteId}/ai-versions/import")
    public ResponseEntity<?> importSharedVersion(
            @PathVariable String noteId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest httpRequest) {
        try {
            String userId = extractUserId(httpRequest);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!verifyNoteOwnership(noteId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You don't have permission to access this note"));
            }

            String sessionId = (String) body.get("sessionId");
            int version = ((Number) body.get("version")).intValue();

            if (sessionId == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "sessionId is required"));
            }

            // Check personal version limit (max 5)
            long personalCount = aiContentVersionService.getPersonalVersionCount(noteId);
            if (personalCount >= 5) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Maximum 5 personal versions allowed"));
            }

            AIContentVersion imported = aiContentVersionService.importSharedVersion(
                    noteId, sessionId, version, userId);

            return ResponseEntity.ok(imported);

        } catch (Exception e) {
            logger.error("Failed to import shared version for note {}: {}", noteId, e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to import version: " + e.getMessage()));
        }
    }

    // ============================================
    // Private helpers
    // ============================================

    private String getBookTitleFromNote(UserSessionNote note) {
        try {
            Optional<Session> sessionOpt = sessionRepository.findById(note.getSessionId());
            if (sessionOpt.isPresent()) {
                Optional<Post> postOpt = postRepository.findById(sessionOpt.get().getPostId());
                if (postOpt.isPresent() && postOpt.get().getBookData() != null) {
                    return postOpt.get().getBookData().getTitle();
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to get book title for note {}: {}", note.getId(), e.getMessage());
        }
        return "Unknown Book";
    }

    private boolean verifyNoteOwnership(String noteId, String userId) {
        Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
        return noteOpt.isPresent() && noteOpt.get().getUserId().equals(userId);
    }

    private String extractUserId(HttpServletRequest request) {
        String token = extractToken(request);
        if (token == null) return null;

        try {
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            Optional<User> userOpt = userRepository.findByUid(uid);
            return userOpt.map(User::getId).orElse(null);

        } catch (FirebaseAuthException e) {
            return null;
        }
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader;
        }

        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("firebase_token".equals(cookie.getName())) {
                    return "Bearer " + cookie.getValue();
                }
            }
        }

        return null;
    }

    // ============================================
    // TipTap JSON conversion (copied from AISummaryController)
    // ============================================

    private String convertToTipTapJson(String text, String language) {
        if (text == null || text.trim().isEmpty()) {
            return getEmptyTipTapDoc(language);
        }

        text = text.replaceAll("⟦note_\\d{3}⟧\\s*", "");

        StringBuilder json = new StringBuilder();
        json.append("{\"type\":\"doc\",\"content\":[");

        String[] lines = text.split("\n");
        boolean firstContent = true;
        boolean inList = false;
        StringBuilder listItems = new StringBuilder();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            if (inList && !trimmed.startsWith("- ") && !trimmed.matches("^\\d+\\.\\s.*")) {
                if (!firstContent) json.append(",");
                json.append("{\"type\":\"bulletList\",\"content\":[").append(listItems).append("]}");
                listItems = new StringBuilder();
                inList = false;
                firstContent = false;
            }

            if (trimmed.equals("---") || trimmed.equals("***") || trimmed.equals("___")) {
                if (!firstContent) json.append(",");
                json.append("{\"type\":\"horizontalRule\"}");
                firstContent = false;
                continue;
            }

            if (trimmed.startsWith("## ")) {
                if (!firstContent) json.append(",");
                String headingText = trimmed.substring(3);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":")
                    .append(convertInlineFormatting(headingText))
                    .append("}");
                firstContent = false;
                continue;
            }

            if (trimmed.startsWith("### ")) {
                if (!firstContent) json.append(",");
                String headingText = trimmed.substring(4);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":3},\"content\":")
                    .append(convertInlineFormatting(headingText))
                    .append("}");
                firstContent = false;
                continue;
            }

            if (trimmed.startsWith("> ")) {
                if (!firstContent) json.append(",");
                String quoteText = trimmed.substring(2);
                json.append("{\"type\":\"blockquote\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(quoteText))
                    .append("}]}");
                firstContent = false;
                continue;
            }

            if (trimmed.startsWith("- ")) {
                String itemText = trimmed.substring(2);
                if (listItems.length() > 0) listItems.append(",");
                listItems.append("{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(itemText))
                    .append("}]}");
                inList = true;
                continue;
            }

            if (trimmed.matches("^\\d+\\.\\s.*")) {
                String itemText = trimmed.replaceFirst("^\\d+\\.\\s*", "");
                if (listItems.length() > 0) listItems.append(",");
                listItems.append("{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(itemText))
                    .append("}]}");
                inList = true;
                continue;
            }

            if (!firstContent) json.append(",");
            json.append("{\"type\":\"paragraph\",\"content\":")
                .append(convertInlineFormatting(trimmed))
                .append("}");
            firstContent = false;
        }

        if (inList && listItems.length() > 0) {
            if (!firstContent) json.append(",");
            json.append("{\"type\":\"bulletList\",\"content\":[").append(listItems).append("]}");
        }

        json.append("]}");
        return json.toString();
    }

    private String convertInlineFormatting(String text) {
        if (text == null || text.isEmpty()) {
            return "[]";
        }

        StringBuilder result = new StringBuilder("[");
        StringBuilder currentText = new StringBuilder();
        boolean inBold = false;
        boolean inItalic = false;
        boolean firstNode = true;
        int i = 0;

        while (i < text.length()) {
            if (i + 1 < text.length() && text.charAt(i) == '*' && text.charAt(i + 1) == '*') {
                if (currentText.length() > 0) {
                    if (!firstNode) result.append(",");
                    result.append(createTextNode(currentText.toString(), inBold, inItalic));
                    currentText = new StringBuilder();
                    firstNode = false;
                }
                inBold = !inBold;
                i += 2;
                continue;
            }

            if (text.charAt(i) == '_') {
                boolean isWordBoundary = (i == 0 || !Character.isLetterOrDigit(text.charAt(i - 1)))
                    || (i + 1 >= text.length() || !Character.isLetterOrDigit(text.charAt(i + 1)));
                if (isWordBoundary) {
                    if (currentText.length() > 0) {
                        if (!firstNode) result.append(",");
                        result.append(createTextNode(currentText.toString(), inBold, inItalic));
                        currentText = new StringBuilder();
                        firstNode = false;
                    }
                    inItalic = !inItalic;
                    i++;
                    continue;
                }
            }

            currentText.append(text.charAt(i));
            i++;
        }

        if (currentText.length() > 0) {
            if (!firstNode) result.append(",");
            result.append(createTextNode(currentText.toString(), inBold, inItalic));
        }

        result.append("]");
        return result.toString();
    }

    private String createTextNode(String text, boolean bold, boolean italic) {
        StringBuilder node = new StringBuilder("{\"type\":\"text\",\"text\":\"");
        node.append(escapeJson(text));
        node.append("\"");

        if (bold || italic) {
            node.append(",\"marks\":[");
            boolean firstMark = true;
            if (bold) {
                node.append("{\"type\":\"bold\"}");
                firstMark = false;
            }
            if (italic) {
                if (!firstMark) node.append(",");
                node.append("{\"type\":\"italic\"}");
            }
            node.append("]");
        }

        node.append("}");
        return node.toString();
    }

    private String getEmptyTipTapDoc(String language) {
        String heading = "ko".equalsIgnoreCase(language) ? "AI 정리된 노트" : "AI Organized Notes";
        String placeholder = "ko".equalsIgnoreCase(language) ? "AI 정리된 내용이 여기에 표시됩니다." : "AI organized content will appear here.";
        return String.format(
            "{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"%s\"}]},{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"%s\"}]}]}",
            heading, placeholder
        );
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }
}
