package com.bookclub.backend.suggestion.service;

import com.bookclub.backend.suggestion.dto.*;
import com.bookclub.backend.suggestion.model.Suggestion;
import com.bookclub.backend.suggestion.model.SuggestionComment;
import com.bookclub.backend.suggestion.model.SuggestionVote;
import com.bookclub.backend.suggestion.repository.SuggestionCommentRepository;
import com.bookclub.backend.suggestion.repository.SuggestionRepository;
import com.bookclub.backend.suggestion.repository.SuggestionVoteRepository;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Service
public class SuggestionService {

    @Autowired
    private SuggestionRepository suggestionRepository;

    @Autowired
    private SuggestionCommentRepository commentRepository;

    @Autowired
    private SuggestionVoteRepository voteRepository;

    @Autowired
    private UserRepository userRepository;

    // 건의사항별 투표 잠금 (동시성 제어)
    private final ConcurrentHashMap<String, ReentrantLock> voteLocks = new ConcurrentHashMap<>();

    private ReentrantLock getVoteLock(String suggestionId, String userId) {
        String key = suggestionId + ":" + userId;
        return voteLocks.computeIfAbsent(key, k -> new ReentrantLock());
    }

    // 건의사항 생성
    public SuggestionResponse createSuggestion(CreateSuggestionRequest request, String userId) {
        User user = userRepository.findByUid(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Suggestion suggestion = new Suggestion();
        suggestion.setTitle(request.getTitle());
        suggestion.setContent(request.getContent());
        suggestion.setTags(request.getTags() != null ? request.getTags() : List.of());
        suggestion.setAuthorId(userId);
        suggestion.setAuthorName(user.getUsername());
        suggestion.setAuthorPhotoUrl(user.getDisplayPhotoUrl());
        suggestion.setStatus("open");
        suggestion.setCreatedAt(LocalDateTime.now());
        suggestion.setUpdatedAt(LocalDateTime.now());

        Suggestion saved = suggestionRepository.save(suggestion);
        return SuggestionResponse.fromEntity(saved, false);
    }

    // 모든 건의사항 조회
    public List<SuggestionResponse> getAllSuggestions(String userId) {
        List<Suggestion> suggestions = suggestionRepository.findByDeletedFalseOrderByUpvoteCountDescCreatedAtDesc();
        return suggestions.stream()
            .map(s -> {
                boolean hasVoted = userId != null && voteRepository.existsBySuggestionIdAndUserId(s.getId(), userId);
                return SuggestionResponse.fromEntity(s, hasVoted);
            })
            .collect(Collectors.toList());
    }

    // 상태별 건의사항 조회
    public List<SuggestionResponse> getSuggestionsByStatus(String status, String userId) {
        List<Suggestion> suggestions = suggestionRepository
            .findByDeletedFalseAndStatusOrderByUpvoteCountDescCreatedAtDesc(status);
        return suggestions.stream()
            .map(s -> {
                boolean hasVoted = userId != null && voteRepository.existsBySuggestionIdAndUserId(s.getId(), userId);
                return SuggestionResponse.fromEntity(s, hasVoted);
            })
            .collect(Collectors.toList());
    }

    // 단일 건의사항 조회
    public SuggestionResponse getSuggestionById(String id, String userId) {
        Suggestion suggestion = suggestionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Suggestion not found"));

        if (suggestion.isDeleted()) {
            throw new RuntimeException("Suggestion has been deleted");
        }

        boolean hasVoted = userId != null && voteRepository.existsBySuggestionIdAndUserId(id, userId);
        return SuggestionResponse.fromEntity(suggestion, hasVoted);
    }

    // 추천(투표) 토글 - 원자적 처리 (사용자별 잠금)
    public SuggestionResponse toggleVote(String suggestionId, String userId) {
        ReentrantLock lock = getVoteLock(suggestionId, userId);
        lock.lock();
        try {
            Suggestion suggestion = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new RuntimeException("Suggestion not found"));

            // 현재 투표 상태 확인 및 토글
            java.util.Optional<SuggestionVote> existingVote =
                voteRepository.findBySuggestionIdAndUserId(suggestionId, userId);

            boolean nowHasVoted;

            if (existingVote.isPresent()) {
                // 투표가 존재하면 삭제 (취소)
                voteRepository.delete(existingVote.get());
                // upvoteCount를 실제 투표 수로 동기화
                long actualCount = voteRepository.countBySuggestionId(suggestionId);
                suggestion.setUpvoteCount((int) actualCount);
                nowHasVoted = false;
            } else {
                // 투표가 없으면 추가
                try {
                    SuggestionVote vote = new SuggestionVote();
                    vote.setSuggestionId(suggestionId);
                    vote.setUserId(userId);
                    vote.setCreatedAt(LocalDateTime.now());
                    voteRepository.save(vote);
                    // upvoteCount를 실제 투표 수로 동기화
                    long actualCount = voteRepository.countBySuggestionId(suggestionId);
                    suggestion.setUpvoteCount((int) actualCount);
                    nowHasVoted = true;
                } catch (org.springframework.dao.DuplicateKeyException e) {
                    // 중복 투표 시도 - 이미 투표가 존재함 (race condition)
                    // 현재 실제 투표 상태를 반환
                    long actualCount = voteRepository.countBySuggestionId(suggestionId);
                    suggestion.setUpvoteCount((int) actualCount);
                    nowHasVoted = true;
                }
            }

            suggestion.setUpdatedAt(LocalDateTime.now());
            Suggestion saved = suggestionRepository.save(suggestion);

            return SuggestionResponse.fromEntity(saved, nowHasVoted);
        } finally {
            lock.unlock();
        }
    }

    // 댓글 생성
    @Transactional
    public CommentResponse createComment(String suggestionId, CreateCommentRequest request, String userId) {
        Suggestion suggestion = suggestionRepository.findById(suggestionId)
            .orElseThrow(() -> new RuntimeException("Suggestion not found"));

        User user = userRepository.findByUid(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        SuggestionComment comment = new SuggestionComment();
        comment.setSuggestionId(suggestionId);
        comment.setAuthorId(userId);
        comment.setAuthorName(user.getUsername());
        comment.setAuthorPhotoUrl(user.getDisplayPhotoUrl());
        comment.setContent(request.getContent());
        comment.setCreatedAt(LocalDateTime.now());
        comment.setUpdatedAt(LocalDateTime.now());

        SuggestionComment saved = commentRepository.save(comment);

        // 건의사항의 댓글 수 업데이트
        suggestion.setCommentCount(suggestion.getCommentCount() + 1);
        suggestion.setLastCommentAt(LocalDateTime.now());
        suggestion.setUpdatedAt(LocalDateTime.now());
        suggestionRepository.save(suggestion);

        return CommentResponse.fromEntity(saved);
    }

    // 댓글 목록 조회
    public List<CommentResponse> getComments(String suggestionId) {
        List<SuggestionComment> comments = commentRepository
            .findBySuggestionIdAndDeletedFalseOrderByCreatedAtAsc(suggestionId);
        return comments.stream()
            .map(CommentResponse::fromEntity)
            .collect(Collectors.toList());
    }

    // 댓글 삭제
    @Transactional
    public void deleteComment(String commentId, String userId) {
        SuggestionComment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found"));

        if (!comment.getAuthorId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this comment");
        }

        comment.setDeleted(true);
        comment.setUpdatedAt(LocalDateTime.now());
        commentRepository.save(comment);

        // 건의사항의 댓글 수 업데이트
        Suggestion suggestion = suggestionRepository.findById(comment.getSuggestionId())
            .orElse(null);
        if (suggestion != null) {
            suggestion.setCommentCount(Math.max(0, suggestion.getCommentCount() - 1));
            suggestion.setUpdatedAt(LocalDateTime.now());
            suggestionRepository.save(suggestion);
        }
    }

    // 건의사항 삭제 (작성자만)
    @Transactional
    public void deleteSuggestion(String suggestionId, String userId) {
        Suggestion suggestion = suggestionRepository.findById(suggestionId)
            .orElseThrow(() -> new RuntimeException("Suggestion not found"));

        if (!suggestion.getAuthorId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this suggestion");
        }

        suggestion.setDeleted(true);
        suggestion.setUpdatedAt(LocalDateTime.now());
        suggestionRepository.save(suggestion);
    }

    // 건의사항 상태 변경 (관리자용 - 추후 구현)
    public SuggestionResponse updateStatus(String suggestionId, String status) {
        Suggestion suggestion = suggestionRepository.findById(suggestionId)
            .orElseThrow(() -> new RuntimeException("Suggestion not found"));

        suggestion.setStatus(status);
        suggestion.setUpdatedAt(LocalDateTime.now());
        Suggestion saved = suggestionRepository.save(suggestion);

        return SuggestionResponse.fromEntity(saved);
    }
}
