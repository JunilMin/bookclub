package com.bookclub.backend.user.repository;

import com.bookclub.backend.user.model.UserBadge;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserBadgeRepository extends MongoRepository<UserBadge, String> {

    /**
     * 사용자 ID로 배지 문서 조회
     */
    Optional<UserBadge> findByUserId(String userId);

    /**
     * 사용자 ID로 배지 문서 존재 여부 확인
     */
    boolean existsByUserId(String userId);

    /**
     * 사용자 ID로 배지 문서 삭제
     */
    void deleteByUserId(String userId);
}
