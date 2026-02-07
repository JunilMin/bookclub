package com.bookclub.backend.suggestion.repository;

import com.bookclub.backend.suggestion.model.SuggestionComment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuggestionCommentRepository extends MongoRepository<SuggestionComment, String> {

    // 건의사항별 댓글 조회 (생성일 순)
    List<SuggestionComment> findBySuggestionIdAndDeletedFalseOrderByCreatedAtAsc(String suggestionId);

    // 건의사항별 댓글 수 카운트
    long countBySuggestionIdAndDeletedFalse(String suggestionId);

    // 작성자별 댓글 조회
    List<SuggestionComment> findByAuthorIdAndDeletedFalseOrderByCreatedAtDesc(String authorId);
}
