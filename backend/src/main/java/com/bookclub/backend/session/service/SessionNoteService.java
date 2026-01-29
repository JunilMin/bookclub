package com.bookclub.backend.session.service;

import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.repository.SessionNoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class SessionNoteService {

    @Autowired
    private SessionNoteRepository sessionNoteRepository;

    public SessionNote getOrCreateNote(String sessionId) {
        Optional<SessionNote> noteOpt = sessionNoteRepository.findBySessionId(sessionId);
        if (noteOpt.isPresent()) {
            return noteOpt.get();
        }

        SessionNote note = new SessionNote(sessionId);
        return sessionNoteRepository.save(note);
    }

    public SessionNote getOrCreateNote(String sessionId, String title) {
        Optional<SessionNote> noteOpt = sessionNoteRepository.findBySessionId(sessionId);
        if (noteOpt.isPresent()) {
            return noteOpt.get();
        }

        SessionNote note = new SessionNote(sessionId, title);
        return sessionNoteRepository.save(note);
    }

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
        return sessionNoteRepository.findBySessionId(sessionId);
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
}
