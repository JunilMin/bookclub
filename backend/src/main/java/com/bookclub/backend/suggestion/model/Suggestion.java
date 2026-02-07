package com.bookclub.backend.suggestion.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "suggestions")
@CompoundIndexes({
    @CompoundIndex(name = "upvote_created_idx", def = "{'upvoteCount': -1, 'createdAt': -1}"),
    @CompoundIndex(name = "status_created_idx", def = "{'status': 1, 'createdAt': -1}")
})
public class Suggestion {

    @Id
    private String id;

    private String title;

    private String content;

    private String authorId;

    private String authorName;

    private String authorPhotoUrl;

    // open, in_review, planned, implemented, rejected
    private String status = "open";

    private List<String> tags = new ArrayList<>();

    private int upvoteCount = 0;

    private int commentCount = 0;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime lastCommentAt;

    private String visibility = "public";

    private boolean deleted = false;

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

    public LocalDateTime getLastCommentAt() {
        return lastCommentAt;
    }

    public void setLastCommentAt(LocalDateTime lastCommentAt) {
        this.lastCommentAt = lastCommentAt;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
