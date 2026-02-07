// backend/src/main/java/com/bookclub/backend/session/SessionRepository.java
package com.bookclub.backend.session;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SessionRepository extends MongoRepository<Session, String> {

    /**
     * Post ID로 세션 찾기
     */
    Optional<Session> findByPostId(String postId);
}
