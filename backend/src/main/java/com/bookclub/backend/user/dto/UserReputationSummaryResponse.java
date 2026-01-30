package com.bookclub.backend.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 사용자 평판 요약 응답 DTO
 * 초기 렌더링용 - 상단 카드/핵심 지표만 포함
 */
@Data
@Builder
public class UserReputationSummaryResponse {

    private UserSummary user;
    private StatsSummary stats;
    private EndorsementSummary endorsement;
    private BadgeSummary badgeSummary;
    private List<ActivityItem> recentActivities;

    /**
     * 사용자 기본 정보
     */
    @Data
    @Builder
    public static class UserSummary {
        private String id;
        private String username;
        private String photoUrl;
        private LocalDateTime joinedAt;
    }

    /**
     * 참여 통계 요약
     */
    @Data
    @Builder
    public static class StatsSummary {
        private double attendanceRate;
        private double onTimeRate;
        private int currentStreak;
        private int totalConfirmed;
        private int feedbackGivenCount;
        private int feedbackPossibleCount;
    }

    /**
     * Endorsement 요약
     */
    @Data
    @Builder
    public static class EndorsementSummary {
        private int points;
        private double averageScore;
        private String topCategory;
        private double topCategoryScore;
    }

    /**
     * 배지 요약 (최신 3개만)
     */
    @Data
    @Builder
    public static class BadgeSummary {
        private int earnedCount;
        private int totalCount;
        private List<Badge> latestBadges;
    }

    /**
     * 배지 정보
     */
    @Data
    @Builder
    public static class Badge {
        private String id;
        private String name;
        private String description;
        private String icon;
        private String gradientColors;
        private LocalDateTime earnedAt;
    }

    /**
     * 활동 항목
     */
    @Data
    @Builder
    public static class ActivityItem {
        private String type;
        private String title;
        private String description;
        private String icon;
        private String gradientColors;
        private LocalDateTime timestamp;
        private Integer participantCount;
        private String postId;
    }
}
