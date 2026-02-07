package com.bookclub.backend.session.controller;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.dto.NoteUpdateMessage;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.service.SessionNoteService;
import com.bookclub.backend.websocket.WebSocketPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class SessionNoteController {

    @Autowired
    private SessionNoteService sessionNoteService;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    private static final java.util.logging.Logger logger = java.util.logging.Logger.getLogger(SessionNoteController.class.getName());

    /**
     * REST: Get session notes
     */
    @GetMapping("/{sessionId}/notes")
    public ResponseEntity<?> getNotes(@PathVariable String sessionId) {
        try {
            String noteTitle = "Discussion Notes";  // Default

            // Handle AI notes suffix - these are separate documents for AI-organized content
            String baseSessionId = sessionId;
            boolean isAiNotes = sessionId.endsWith("-ai");
            if (isAiNotes) {
                baseSessionId = sessionId.substring(0, sessionId.length() - 3);
                noteTitle = "AI Organized Notes";
            }

            // Get Session to find Post (only for non-AI notes or to get book title)
            Optional<Session> sessionOpt = sessionRepository.findById(baseSessionId);

            if (sessionOpt.isPresent()) {
                Session session = sessionOpt.get();
                Optional<Post> postOpt = postRepository.findById(session.getPostId());
                if (postOpt.isPresent()) {
                    Post post = postOpt.get();
                    String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Unknown Book";

                    if (isAiNotes) {
                        // AI notes title
                        noteTitle = "[AI] " + bookTitle;
                    } else {
                        // Regular notes title: [yyyy-MM-dd] BookTitle
                        if (post.getDue() != null) {
                            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
                            String dateStr = post.getDue().format(dateFormatter);
                            noteTitle = "[" + dateStr + "] " + bookTitle;
                        } else {
                            noteTitle = bookTitle;
                        }
                    }
                }
            }

            SessionNote note = sessionNoteService.getOrCreateNote(sessionId, noteTitle);
            return ResponseEntity.ok(note);
        } catch (Exception e) {
            logger.severe("Error getting notes for sessionId=" + sessionId + ": " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "error", e.getClass().getSimpleName(),
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error",
                "sessionId", sessionId
            ));
        }
    }

    /**
     * REST: Update session notes (fallback)
     */
    @PutMapping("/{sessionId}/notes")
    public ResponseEntity<SessionNote> updateNotes(
            @PathVariable String sessionId,
            @RequestBody NoteUpdateMessage message) {
        SessionNote note = sessionNoteService.updateNote(
                sessionId,
                message.getContent(),
                message.getUserId()
        );
        return ResponseEntity.ok(note);
    }

    /**
     * REST: Update note title
     */
    @PutMapping("/{sessionId}/notes/title")
    public ResponseEntity<SessionNote> updateTitle(
            @PathVariable String sessionId,
            @RequestBody Map<String, String> payload) {
        String title = payload.get("title");
        String userId = payload.get("userId");

        if (title == null || title.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        SessionNote note = sessionNoteService.updateTitle(sessionId, title, userId);
        return ResponseEntity.ok(note);
    }

    /**
     * REST: Update AI organized notes (for collaborative editing of AI content)
     */
    @PutMapping("/{sessionId}/notes/ai")
    public ResponseEntity<SessionNote> updateAiNotes(
            @PathVariable String sessionId,
            @RequestBody NoteUpdateMessage message) {
        SessionNote note = sessionNoteService.updateAiContent(
                sessionId,
                message.getContent()
        );
        return ResponseEntity.ok(note);
    }

    /**
     * WebSocket: Handle note updates
     */
    @MessageMapping("/session/{sessionId}/notes")
    @SendTo("/topic/session/{sessionId}/notes")
    public NoteUpdateMessage handleNoteUpdate(
            @DestinationVariable String sessionId,
            NoteUpdateMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // Get user from WebSocket authentication
        UsernamePasswordAuthenticationToken auth =
                (UsernamePasswordAuthenticationToken) headerAccessor.getUser();

        if (auth != null && auth.getPrincipal() instanceof WebSocketPrincipal) {
            WebSocketPrincipal principal = (WebSocketPrincipal) auth.getPrincipal();
            message.setUid(principal.getUid());
        }

        // Save to database
        sessionNoteService.updateNote(sessionId, message.getContent(), message.getUserId());

        return message;
    }

    // ============================================
    // Block Management Endpoints (v2.0 - Block-based SSOT)
    // ============================================

    /**
     * REST: Get block order for a session
     */
    @GetMapping("/{sessionId}/notes/blocks/order")
    public ResponseEntity<List<String>> getBlockOrder(@PathVariable String sessionId) {
        List<String> blockOrder = sessionNoteService.getBlockOrder(sessionId);
        return ResponseEntity.ok(blockOrder);
    }

    /**
     * REST: Update block order for a session (reorder via drag-drop)
     */
    @PutMapping("/{sessionId}/notes/blocks/order")
    public ResponseEntity<SessionNote> updateBlockOrder(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> payload) {

        @SuppressWarnings("unchecked")
        List<String> blockOrder = (List<String>) payload.get("blockOrder");
        String userId = (String) payload.get("userId");

        if (blockOrder == null) {
            return ResponseEntity.badRequest().build();
        }

        SessionNote note = sessionNoteService.updateBlockOrder(sessionId, blockOrder, userId);
        return ResponseEntity.ok(note);
    }

    /**
     * REST: Get all blocks for a session (v2.0)
     */
    @GetMapping("/{sessionId}/notes/blocks")
    public ResponseEntity<Map<String, SessionNote.Block>> getAllBlocks(@PathVariable String sessionId) {
        Map<String, SessionNote.Block> blocks = sessionNoteService.getAllBlocks(sessionId);
        return ResponseEntity.ok(blocks);
    }

    /**
     * REST: Get specific block (v2.0)
     */
    @GetMapping("/{sessionId}/notes/blocks/{blockId}")
    public ResponseEntity<SessionNote.Block> getBlock(
            @PathVariable String sessionId,
            @PathVariable String blockId) {

        SessionNote.Block block = sessionNoteService.getBlock(sessionId, blockId);
        if (block == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(block);
    }

    /**
     * REST: Update block content (v2.0)
     * Used for saving block edits after lock acquisition
     */
    @PutMapping("/{sessionId}/notes/blocks/{blockId}/content")
    public ResponseEntity<?> updateBlockContent(
            @PathVariable String sessionId,
            @PathVariable String blockId,
            @RequestBody Map<String, Object> payload) {

        String content = (String) payload.get("content");
        String userId = (String) payload.get("userId");
        Integer version = payload.get("version") != null
            ? ((Number) payload.get("version")).intValue()
            : 0;

        if (content == null || userId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "content and userId are required"));
        }

        SessionNote.Block block = sessionNoteService.updateBlockContent(sessionId, blockId, content, userId, version);
        if (block == null) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "VERSION_CONFLICT",
                "message", "Block version mismatch. Please refresh and try again."
            ));
        }

        return ResponseEntity.ok(block);
    }

    /**
     * REST: Add new block (v2.0)
     */
    @PostMapping("/{sessionId}/notes/blocks")
    public ResponseEntity<SessionNote.Block> addBlock(
            @PathVariable String sessionId,
            @RequestBody Map<String, String> payload) {

        String type = payload.get("type");
        String content = payload.get("content");
        String afterBlockId = payload.get("afterBlockId");
        String userId = payload.get("userId");

        if (type == null || content == null || userId == null) {
            return ResponseEntity.badRequest().build();
        }

        SessionNote.Block block = sessionNoteService.addBlock(sessionId, type, content, afterBlockId, userId);
        return ResponseEntity.status(201).body(block);
    }

    /**
     * REST: Delete block (v2.0)
     */
    @DeleteMapping("/{sessionId}/notes/blocks/{blockId}")
    public ResponseEntity<?> deleteBlock(
            @PathVariable String sessionId,
            @PathVariable String blockId,
            @RequestParam(required = false) String userId) {

        boolean deleted = sessionNoteService.deleteBlock(sessionId, blockId, userId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of("success", true, "blockId", blockId));
    }

    // ============================================
    // Legacy Endpoints (deprecated, for backward compatibility)
    // ============================================

    /**
     * @deprecated Use PUT /{sessionId}/notes/blocks/{blockId}/content instead
     */
    @Deprecated
    @PutMapping("/{sessionId}/notes/blocks/{blockId}/meta")
    public ResponseEntity<SessionNote> upsertBlock(
            @PathVariable String sessionId,
            @PathVariable String blockId,
            @RequestBody Map<String, String> payload) {

        String type = payload.get("type");
        String createdBy = payload.get("createdBy");

        SessionNote.BlockMeta blockMeta = new SessionNote.BlockMeta(blockId, type, createdBy);
        SessionNote note = sessionNoteService.upsertBlockMeta(sessionId, blockMeta);

        return ResponseEntity.ok(note);
    }
}
