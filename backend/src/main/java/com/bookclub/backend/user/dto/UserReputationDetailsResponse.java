package com.bookclub.backend.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 사용자 평판 상세 응답 DTO
 * 탭 진입 시 로드 - 월별 출석/전체 배지/전체 활동 포함
 */
@Data
@Builder
public class UserReputationDetailsResponse {

    private List<MonthlyAttendance> monthlyAttendance;
    private BadgeInfo badgeInfo;
    private List<ActivityItem> recentActivities;

    /**
     * 월별 출석 기록
     */
    @Data
    @Builder
    public static class MonthlyAttendance {
        private String month;
        private String monthLabel;
        private int attended;
        private int late;
        private int absent;
        private int total;
    }

    /**
     * 배지 전체 정보
     */
    @Data
    @Builder
    public static class BadgeInfo {
        private int earnedCount;
        private int totalCount;
        private List<Badge> earnedBadges;
        private List<Badge> lockedBadges;
    }

    /**
     * 배지 정보 (진행도 포함)
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
        private Integer progress;
        private Integer goal;
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
