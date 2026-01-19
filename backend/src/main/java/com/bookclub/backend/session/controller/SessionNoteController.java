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

    /**
     * REST: Get session notes
     */
    @GetMapping("/{sessionId}/notes")
    public ResponseEntity<SessionNote> getNotes(@PathVariable String sessionId) {
        // Get Session to find Post
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        String noteTitle = "Discussion Notes";  // Default

        if (sessionOpt.isPresent()) {
            Session session = sessionOpt.get();
            Optional<Post> postOpt = postRepository.findById(session.getPostId());
            if (postOpt.isPresent()) {
                Post post = postOpt.get();
                String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Unknown Book";

                // Format: [yyyy-MM-dd] BookTitle
                if (post.getDue() != null) {
                    DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
                    String dateStr = post.getDue().format(dateFormatter);
                    noteTitle = "[" + dateStr + "] " + bookTitle;
                } else {
                    noteTitle = bookTitle;
                }
            }
        }

        SessionNote note = sessionNoteService.getOrCreateNote(sessionId, noteTitle);
        return ResponseEntity.ok(note);
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
}
