package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.UserSessionNote;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSessionNoteRepository extends MongoRepository<UserSessionNote, String> {

    /**
     * 특정 사용자의 모든 개인 노트 조회
     */
    List<UserSessionNote> findByUserId(String userId);

    /**
     * 특정 사용자의 노트를 최신순으로 조회
     */
    List<UserSessionNote> findByUserIdOrderByUpdatedAtDesc(String userId);

    /**
     * 특정 세션의 특정 사용자 노트 조회
     */
    Optional<UserSessionNote> findBySessionIdAndUserId(String sessionId, String userId);

    /**
     * 특정 세션의 모든 개인 노트 조회 (관리용)
     */
    List<UserSessionNote> findBySessionId(String sessionId);

    /**
     * 특정 사용자가 해당 세션의 노트를 가지고 있는지 확인
     */
    boolean existsBySessionIdAndUserId(String sessionId, String userId);

    /**
     * 특정 원본 노트에서 fork된 모든 개인 노트 조회
     */
    List<UserSessionNote> findByBaseNoteId(String baseNoteId);
}
