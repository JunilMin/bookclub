package com.bookclub.backend.session.controller;

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

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class SessionNoteController {

    @Autowired
    private SessionNoteService sessionNoteService;

    /**
     * REST: Get session notes
     */
    @GetMapping("/{sessionId}/notes")
    public ResponseEntity<SessionNote> getNotes(@PathVariable String sessionId) {
        SessionNote note = sessionNoteService.getOrCreateNote(sessionId);
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
                message.getUsername()
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
        sessionNoteService.updateNote(sessionId, message.getContent(), message.getUsername());

        return message;
    }
}
