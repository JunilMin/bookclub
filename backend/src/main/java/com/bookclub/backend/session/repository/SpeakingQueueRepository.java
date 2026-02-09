package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.SpeakingQueue;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpeakingQueueRepository extends MongoRepository<SpeakingQueue, String> {
    Optional<SpeakingQueue> findFirstBySessionId(String sessionId);

    List<SpeakingQueue> findBySessionIdIn(List<String> sessionIds);

    void deleteAllBySessionId(String sessionId);
}
