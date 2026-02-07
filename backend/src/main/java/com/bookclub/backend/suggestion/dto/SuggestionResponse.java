package com.bookclub.backend.suggestion.dto;

import com.bookclub.backend.suggestion.model.Suggestion;

import java.time.LocalDateTime;
import java.util.List;

public class SuggestionResponse {

    private String id;
    private String title;
    private String content;
    private String authorId;
    private String authorName;
    private String authorPhotoUrl;
    private String status;
    private List<String> tags;
    private int upvoteCount;
    private int commentCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean hasVoted;  // 현재 사용자의 투표 여부

    public static SuggestionResponse fromEntity(Suggestion suggestion) {
        SuggestionResponse response = new SuggestionResponse();
        response.setId(suggestion.getId());
        response.setTitle(suggestion.getTitle());
        response.setContent(suggestion.getContent());
        response.setAuthorId(suggestion.getAuthorId());
        response.setAuthorName(suggestion.getAuthorName());
        response.setAuthorPhotoUrl(suggestion.getAuthorPhotoUrl());
        response.setStatus(suggestion.getStatus());
        response.setTags(suggestion.getTags());
        response.setUpvoteCount(suggestion.getUpvoteCount());
        response.setCommentCount(suggestion.getCommentCount());
        response.setCreatedAt(suggestion.getCreatedAt());
        response.setUpdatedAt(suggestion.getUpdatedAt());
        response.setHasVoted(false);
        return response;
    }

    public static SuggestionResponse fromEntity(Suggestion suggestion, boolean hasVoted) {
        SuggestionResponse response = fromEntity(suggestion);
        response.setHasVoted(hasVoted);
        return response;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorPhotoUrl() {
        return authorPhotoUrl;
    }

    public void setAuthorPhotoUrl(String authorPhotoUrl) {
        this.authorPhotoUrl = authorPhotoUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public int getUpvoteCount() {
        return upvoteCount;
    }

    public void setUpvoteCount(int upvoteCount) {
        this.upvoteCount = upvoteCount;
    }

    public int getCommentCount() {
        return commentCount;
    }

    public void setCommentCount(int commentCount) {
        this.commentCount = commentCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public boolean isHasVoted() {
        return hasVoted;
    }

    public void setHasVoted(boolean hasVoted) {
        this.hasVoted = hasVoted;
    }
}
