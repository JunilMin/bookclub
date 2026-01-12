package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SessionNote;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SessionNoteRepository extends MongoRepository<SessionNote, String> {
    Optional<SessionNote> findBySessionId(String sessionId);
}
