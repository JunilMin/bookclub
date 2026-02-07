package com.bookclub.backend.session.dto;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.session.model.SessionRecording;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for user's discussion note summaries
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NoteSummaryResponse {
    private String sessionId;
    private String postId;

    // Book info
    private String bookTitle;
    private String bookAuthor;
    private Post.BookCover bookCover;  // { small, medium }
    private String bookGenre;
    private String bookIsbn;

    // Meeting info
    private LocalDateTime meetingDate;
    private Integer duration;
    private int participantCount;
    private String level;

    // Host info
    private String hostId;
    private String hostUsername;
    private String hostPhotoUrl;
    private Integer hostRating;

    // Summary info
    private SessionRecording.AISummary aiSummary;
    private LocalDateTime sessionCreatedAt;

    // User's relation to this meeting
    private boolean isHost;
    private boolean isFavorite;
}
