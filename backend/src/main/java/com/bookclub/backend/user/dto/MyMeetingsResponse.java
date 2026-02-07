package com.bookclub.backend.user.dto;

import com.bookclub.backend.post.Post;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 내 미팅 목록 응답 DTO
 * Profile 페이지에서 필요한 최소 필드만 포함
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyMeetingsResponse {

    private List<MeetingSummary> created;      // 내가 만든 미팅
    private List<MeetingSummary> participated; // 참여 중인 미팅

    /**
     * 미팅 요약 정보 (최소 필드)
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MeetingSummary {
        private String id;
        private LocalDateTime due;
        private int capacity;
        private int memberCount;
        private String level;
        private boolean ended;
        private BookSummary bookData;

        public static MeetingSummary from(Post post) {
            return MeetingSummary.builder()
                .id(post.getId())
                .due(post.getDue())
                .capacity(post.getCapacity())
                .memberCount(post.getMemberIds() != null ? post.getMemberIds().size() : 0)
                .level(post.getLevel())
                .ended(post.isEnded())
                .bookData(BookSummary.from(post.getBookData()))
                .build();
        }
    }

    /**
     * 책 요약 정보 (최소 필드)
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookSummary {
        private String title;
        private String coverSmall;

        public static BookSummary from(Post.BookData bookData) {
            if (bookData == null) {
                return BookSummary.builder()
                    .title("Unknown")
                    .coverSmall(null)
                    .build();
            }
            Post.BookCover cover = bookData.getCover();
            return BookSummary.builder()
                .title(bookData.getTitle())
                .coverSmall(cover != null ? cover.getSmall() : null)
                .build();
        }
    }
}
