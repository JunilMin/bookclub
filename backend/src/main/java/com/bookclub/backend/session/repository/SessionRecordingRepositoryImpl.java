package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SessionRecording;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * Custom repository implementation for atomic operations on SessionRecording
 */
@Repository
public class SessionRecordingRepositoryImpl implements SessionRecordingRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public SessionRecordingRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public int incrementAndGetUtteranceCount(String sessionId) {
        Query query = new Query(Criteria.where("sessionId").is(sessionId));

        Update update = new Update()
            .inc("utteranceCount", 1)
            .set("lastUtteranceAt", LocalDateTime.now());

        FindAndModifyOptions options = FindAndModifyOptions.options()
            .returnNew(true)  // Return the document after the update
            .upsert(false);   // Don't create if doesn't exist

        SessionRecording result = mongoTemplate.findAndModify(
            query,
            update,
            options,
            SessionRecording.class
        );

        if (result == null) {
            // SessionRecording doesn't exist yet, create it with count = 1
            SessionRecording newRecording = new SessionRecording(sessionId);
            newRecording.setUtteranceCount(1);
            newRecording.setLastUtteranceAt(LocalDateTime.now());
            mongoTemplate.save(newRecording);
            return 1;
        }

        return result.getUtteranceCount();
    }
}
