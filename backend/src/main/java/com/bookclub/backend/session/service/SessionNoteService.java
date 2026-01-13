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

    public SessionNote updateNote(String sessionId, String content, String username) {
        SessionNote note = getOrCreateNote(sessionId);
        note.setContent(content);
        note.setLastEditedBy(username);
        note.setUpdatedAt(LocalDateTime.now());
        note.setVersion(note.getVersion() + 1);
        return sessionNoteRepository.save(note);
    }

    public SessionNote updateTitle(String sessionId, String title, String username) {
        SessionNote note = getOrCreateNote(sessionId);
        note.setTitle(title);
        note.setLastEditedBy(username);
        note.setUpdatedAt(LocalDateTime.now());
        return sessionNoteRepository.save(note);
    }

    public Optional<SessionNote> getNoteBySessionId(String sessionId) {
        return sessionNoteRepository.findBySessionId(sessionId);
    }
}
