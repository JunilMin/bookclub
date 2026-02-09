package com.bookclub.backend.session.dto;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.session.model.SessionRecording;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 사용자 개인 노트 응답 DTO (미팅 컨텍스트 포함)
 */
@Data
public class UserNoteResponse {
    // Note Info
    private String noteId;
    private String sessionId;
    private String postId;
    private String title;
    private String content;
    private int version;
    private LocalDateTime noteCreatedAt;
    private LocalDateTime noteUpdatedAt;

    // Book Info
    private String bookTitle;
    private String bookAuthor;
    private Post.BookCover bookCover;  // { small, medium }
    private String bookGenre;
    private String bookIsbn;

    // Meeting Info
    private LocalDateTime meetingDate;
    private Integer duration;
    private int participantCount;
    private String level;

    // Host Info
    private String hostId;
    private String hostUsername;
    private String hostPhotoUrl;
    private Integer hostRating;

    // Participants (호스트 포함)
    private List<ParticipantInfo> participants;

    // AI Summary (if available)
    private SessionRecording.AISummary aiSummary;

    // Personal AI Summary (user-specific, stored in UserSessionNote)
    private SessionRecording.AISummary personalAiSummary;

    // User's relation
    private boolean isHost;
    private boolean liked;

    /**
     * 참가자 정보
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParticipantInfo {
        private String id;
        private String username;
        private String photoUrl;
        private Integer rating;
        private boolean isHost;
    }
}
