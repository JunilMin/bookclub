package com.bookclub.backend.suggestion.repository;

import com.bookclub.backend.suggestion.model.SuggestionVote;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SuggestionVoteRepository extends MongoRepository<SuggestionVote, String> {

    // 특정 사용자가 특정 건의사항에 투표했는지 확인
    Optional<SuggestionVote> findBySuggestionIdAndUserId(String suggestionId, String userId);

    // 사용자의 투표 존재 여부 확인
    boolean existsBySuggestionIdAndUserId(String suggestionId, String userId);

    // 건의사항별 투표 수 카운트
    long countBySuggestionId(String suggestionId);

    // 건의사항의 투표 삭제
    void deleteBySuggestionIdAndUserId(String suggestionId, String userId);
}
