package com.bookclub.backend.user.dto;

import com.bookclub.backend.user.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 프로필 요약 응답 DTO
 * Profile 페이지 상단 + 최근 활동/배지 요약 제공
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileSummaryResponse {

    private UserSummary user;
    private Stats stats;
    private BadgeSummary badges;
    private List<ActivitySummary> activities;

    /**
     * 사용자 기본 정보
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserSummary {
        private String id;
        private String username;
        private String photoUrl;
        private String email;
        private LocalDateTime createdAt;
        private int endorsementPoints;

        public static UserSummary from(User user) {
            int points = 0;
            if (user.getEndorsementStats() != null) {
                points = user.getEndorsementStats().getPoints();
            }
            return UserSummary.builder()
                .id(user.getId())
                .username(user.getUsername())
                .photoUrl(user.getDisplayPhotoUrl())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .endorsementPoints(points)
                .build();
        }
    }

    /**
     * 통계 요약
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Stats {
        private int createdCount;
        private int participatedCount;
        private double topRatingScore;
        private String topRatingCategory;
    }

    /**
     * 배지 요약
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BadgeSummary {
        private int earnedCount;
        private int totalCount;
        private List<BadgeInfo> recentBadges; // 최근 획득한 배지 (최대 3개)
    }

    /**
     * 배지 정보
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BadgeInfo {
        private String id;
        private String name;
        private String icon;
        private String gradientColors;
        private String earnedAt;
    }

    /**
     * 활동 요약
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivitySummary {
        private String type;
        private String title;
        private String description;
        private String icon;
        private String gradientColors;
        private String timestamp;
        private String postId;
    }
}
