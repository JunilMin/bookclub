package com.bookclub.backend.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 사용자 평판 및 활동 데이터 응답 DTO
 */
@Data
@Builder
public class UserReputationResponse {

    // 기본 사용자 정보
    private String userId;
    private String username;
    private String email;
    private String photoUrl;
    private LocalDateTime joinedAt;

    // 참여 통계
    private ParticipationStats participationStats;

    // Endorsement 통계
    private EndorsementStatsDto endorsementStats;

    // 배지 정보
    private BadgeInfo badgeInfo;

    // 최근 활동 타임라인
    private List<ActivityItem> recentActivities;

    // 월별 출석 기록 (최근 12개월)
    private List<MonthlyAttendance> monthlyAttendance;

    /**
     * 참여 통계
     */
    @Data
    @Builder
    public static class ParticipationStats {
        private int createdAndAttended; // 생성&참여 (created posts where CONFIRMED)
        private int participated;       // 참여 (participated posts where CONFIRMED)
        private int absent;             // 불참 (no record OR status != CONFIRMED)
        private int late;               // 지각 (attendanceType == LATE)
        private int kicked;             // 강퇴 당한 횟수
        private int totalMeetings;      // 총 미팅 수 (created + participated)
        private double attendanceRate;  // 출석률 (%) = (confirmed / total) * 100
        private double onTimeRate;      // 정시 출석률 (%) = (EARLY + ON_TIME) / confirmed * 100

        // Profile card 통계
        private int totalConfirmed;     // 총 참석 (createdAndAttended + participated)
        private int onTimeCount;        // 정시+빠른 입장 횟수 (EARLY + ON_TIME)
        private int currentStreak;      // 현재 연속 참여 기록
        private int feedbackGivenCount; // 피드백(endorsement) 준 횟수
        private int feedbackPossibleCount; // 피드백 줄 수 있었던 총 인원 (참여한 종료 토론의 참가자 수 - 1의 합)
        private int feedbackReceivedCount; // 피드백(endorsement) 받은 횟수
    }

    /**
     * Endorsement 통계
     */
    @Data
    @Builder
    public static class EndorsementStatsDto {
        private int count;              // 총 받은 횟수
        private int points;             // 총 점수
        private Map<String, Integer> categoryCounts;  // 카테고리별 횟수
        private Map<String, Double> categoryScores;   // 카테고리별 평균 (5점 만점 환산)
        private double averageScore;    // 전체 평균 점수
    }

    /**
     * 배지 정보
     */
    @Data
    @Builder
    public static class BadgeInfo {
        private int earnedCount;        // 획득한 배지 수
        private int totalCount;         // 전체 배지 수
        private List<Badge> earnedBadges;   // 획득한 배지 목록
        private List<Badge> lockedBadges;   // 잠긴 배지 목록
    }

    /**
     * 개별 배지
     */
    @Data
    @Builder
    public static class Badge {
        private String id;
        private String name;
        private String description;
        private String icon;            // 아이콘 이름 또는 URL
        private String gradientColors;  // 그라데이션 색상 (예: "#10B981,#059669")
        private LocalDateTime earnedAt; // 획득 날짜 (획득한 경우)
        private Integer progress;       // 진행도 (잠긴 경우)
        private Integer goal;           // 목표 (잠긴 경우)
    }

    /**
     * 활동 타임라인 항목
     */
    @Data
    @Builder
    public static class ActivityItem {
        private String type;            // "MEETING", "BADGE", "ENDORSEMENT"
        private String title;
        private String description;
        private String icon;
        private String gradientColors;
        private LocalDateTime timestamp;
        private Double rating;          // 미팅인 경우 받은 평점
        private Integer participantCount;  // 미팅인 경우 참가자 수
        private String postId;          // 관련 포스트 ID
    }

    /**
     * 월별 출석 기록
     */
    @Data
    @Builder
    public static class MonthlyAttendance {
        private String month;           // "2024-01" 형식
        private String monthLabel;      // "1월" 또는 "Jan" 형식
        private int attended;
        private int late;
        private int absent;
        private int total;
    }
}
