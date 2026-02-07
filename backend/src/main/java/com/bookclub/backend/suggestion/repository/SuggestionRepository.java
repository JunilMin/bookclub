package com.bookclub.backend.suggestion.repository;

import com.bookclub.backend.suggestion.model.Suggestion;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuggestionRepository extends MongoRepository<Suggestion, String> {

    // 삭제되지 않은 건의사항 전체 조회 (추천수, 생성일 순)
    List<Suggestion> findByDeletedFalseOrderByUpvoteCountDescCreatedAtDesc();

    // 삭제되지 않은 건의사항 상태별 조회
    List<Suggestion> findByDeletedFalseAndStatusOrderByUpvoteCountDescCreatedAtDesc(String status);

    // 작성자별 조회
    List<Suggestion> findByAuthorIdAndDeletedFalseOrderByCreatedAtDesc(String authorId);

    // 추천수 범위로 조회
    List<Suggestion> findByDeletedFalseAndUpvoteCountBetweenOrderByUpvoteCountDescCreatedAtDesc(
        int minVotes, int maxVotes);

    // 추천수 이상으로 조회
    List<Suggestion> findByDeletedFalseAndUpvoteCountGreaterThanEqualOrderByUpvoteCountDescCreatedAtDesc(
        int minVotes);
}
