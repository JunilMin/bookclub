package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SessionRecording;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SessionRecordingRepository extends MongoRepository<SessionRecording, String> {
    Optional<SessionRecording> findBySessionId(String sessionId);
}
