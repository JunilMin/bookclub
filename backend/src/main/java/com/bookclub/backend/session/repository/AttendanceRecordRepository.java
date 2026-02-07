package com.bookclub.backend.session.repository;

import com.bookclub.backend.session.model.AttendanceRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends MongoRepository<AttendanceRecord, String> {

    /**
     * 세션의 모든 출석 기록 조회
     */
    List<AttendanceRecord> findAllBySessionId(String sessionId);

    /**
     * 특정 세션의 특정 사용자 출석 기록 조회
     */
    Optional<AttendanceRecord> findBySessionIdAndUserId(String sessionId, String userId);

    /**
     * 특정 세션의 특정 사용자 출석 기록 조회 (중복 감지용 - 모든 기록 반환)
     */
    List<AttendanceRecord> findAllBySessionIdAndUserId(String sessionId, String userId);

    /**
     * 특정 Post의 모든 출석 기록 조회
     */
    List<AttendanceRecord> findAllByPostId(String postId);

    /**
     * 특정 Post의 특정 사용자 출석 기록 조회
     */
    Optional<AttendanceRecord> findByPostIdAndUserId(String postId, String userId);

    /**
     * 특정 Post의 특정 사용자 출석 기록 조회 (중복 감지용 - 모든 기록 반환)
     */
    List<AttendanceRecord> findAllByPostIdAndUserId(String postId, String userId);

    /**
     * 특정 사용자의 모든 출석 기록 조회 (최신순)
     */
    List<AttendanceRecord> findAllByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * 특정 사용자의 확정된 출석 기록만 조회
     */
    List<AttendanceRecord> findAllByUserIdAndStatus(String userId, AttendanceRecord.AttendanceStatus status);

    /**
     * 세션 삭제 시 관련 출석 기록 삭제
     */
    void deleteAllBySessionId(String sessionId);

    /**
     * Post 삭제 시 관련 출석 기록 삭제
     */
    void deleteAllByPostId(String postId);
}
