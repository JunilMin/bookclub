package com.bookclub.backend.user;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.user.dto.UserReputationResponse;
import com.bookclub.backend.user.dto.UserReputationResponse.*;
import com.bookclub.backend.user.model.UserBadge;
import com.bookclub.backend.user.model.UserBadge.BadgeStatus;
import com.bookclub.backend.user.service.UserBadgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 사용자 평판 및 활동 데이터를 계산하는 서비스
 */
@Service
public class UserReputationService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserBadgeService userBadgeService;

    // 6개 endorsement 카테고리
    private static final List<String> ENDORSEMENT_CATEGORIES = Arrays.asList(
        "ENGAGEMENT", "COMMUNICATION", "RESPECT", "RULE_ADHERENCE", "PREPARATION", "REMATCH"
    );

    /**
     * 사용자의 전체 평판 및 활동 데이터를 조회
     */
    public UserReputationResponse getUserReputation(String userId, String locale) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + userId));

        boolean isKorean = "ko".equalsIgnoreCase(locale);

        // 참여한 포스트들 조회
        List<Post> participatedPosts = getParticipatedPosts(user);
        List<Post> createdPosts = getCreatedPosts(user);

        return UserReputationResponse.builder()
            .userId(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .photoUrl(user.getPhotoUrl())
            .joinedAt(null) // MongoDB에서 createdAt이 없으므로 null
            .participationStats(calculateParticipationStats(user, participatedPosts, createdPosts))
            .endorsementStats(calculateEndorsementStats(user))
            .badgeInfo(calculateBadgeInfo(user, participatedPosts, createdPosts, isKorean))
            .recentActivities(calculateRecentActivities(user, participatedPosts, isKorean))
            .monthlyAttendance(calculateMonthlyAttendance(participatedPosts, isKorean))
            .build();
    }

    /**
     * 참여 통계 계산
     */
    private ParticipationStats calculateParticipationStats(User user, List<Post> participatedPosts, List<Post> createdPosts) {
        int totalParticipated = participatedPosts.size();
        int absent = user.getAbsent() != 0 ? user.getAbsent() : 0;
        int late = user.getLate() != 0 ? user.getLate() : 0;
        int kicked = user.getKicked() != 0 ? user.getKicked() : 0;
        int created = createdPosts.size();

        // 참석 = 총 참여 - 불참
        int attended = Math.max(0, totalParticipated - absent);

        // 출석률 = (참석 / 총 참여) * 100
        double attendanceRate = totalParticipated > 0 ? ((double) attended / totalParticipated) * 100 : 100;

        // 정시 출석률 = ((참석 - 지각) / 총 참여) * 100
        int onTime = Math.max(0, attended - late);
        double onTimeRate = totalParticipated > 0 ? ((double) onTime / totalParticipated) * 100 : 100;

        return ParticipationStats.builder()
            .totalParticipated(totalParticipated)
            .attended(attended)
            .absent(absent)
            .late(late)
            .kicked(kicked)
            .created(created)
            .attendanceRate(Math.round(attendanceRate * 10) / 10.0)
            .onTimeRate(Math.round(onTimeRate * 10) / 10.0)
            .build();
    }

    /**
     * Endorsement 통계 계산
     */
    private EndorsementStatsDto calculateEndorsementStats(User user) {
        User.EndorsementStats stats = user.getEndorsementStats();

        int count = 0;
        int points = 0;
        Map<String, Integer> categoryCounts = new HashMap<>();
        Map<String, Double> categoryScores = new HashMap<>();

        // 기본값으로 0 초기화
        for (String cat : ENDORSEMENT_CATEGORIES) {
            categoryCounts.put(cat, 0);
            categoryScores.put(cat, 0.0);
        }

        if (stats != null) {
            count = stats.getCount() != 0 ? stats.getCount() : 0;
            points = stats.getPoints() != 0 ? stats.getPoints() : 0;

            if (stats.getCategoryCounts() != null) {
                for (String cat : ENDORSEMENT_CATEGORIES) {
                    int catCount = stats.getCategoryCounts().getOrDefault(cat, 0);
                    categoryCounts.put(cat, catCount);

                    // 5점 만점 환산 (count가 0이 아니면 catCount / count * 5)
                    // 하지만 더 의미있게: 최대 받을 수 있는 점수 대비 비율
                    // count가 endorsement 받은 횟수이고, 각 카테고리는 1점씩
                    double score = count > 0 ? ((double) catCount / count) * 5.0 : 0.0;
                    categoryScores.put(cat, Math.round(score * 10) / 10.0);
                }
            }
        }

        // 전체 평균 점수 (6개 카테고리 평균)
        double averageScore = categoryScores.values().stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);

        return EndorsementStatsDto.builder()
            .count(count)
            .points(points)
            .categoryCounts(categoryCounts)
            .categoryScores(categoryScores)
            .averageScore(Math.round(averageScore * 10) / 10.0)
            .build();
    }

    /**
     * 배지 정보 계산 (badges 컬렉션 사용)
     */
    private BadgeInfo calculateBadgeInfo(User user, List<Post> participatedPosts, List<Post> createdPosts, boolean isKorean) {
        List<Badge> earnedBadges = new ArrayList<>();
        List<Badge> lockedBadges = new ArrayList<>();

        // 배지 달성 상태 확인 및 업데이트
        UserBadge userBadge = userBadgeService.checkAndUpdateBadges(user.getId());
        Map<String, BadgeStatus> badgeStatuses = userBadge.getBadges();

        int totalParticipated = participatedPosts.size();
        int totalCreated = createdPosts.size();
        User.EndorsementStats endorsementStats = user.getEndorsementStats();

        Map<String, Integer> categoryCounts = new HashMap<>();
        int totalPoints = 0;
        if (endorsementStats != null) {
            totalPoints = endorsementStats.getPoints() != 0 ? endorsementStats.getPoints() : 0;
            if (endorsementStats.getCategoryCounts() != null) {
                categoryCounts = endorsementStats.getCategoryCounts();
            }
        }

        for (BadgeDefinition def : BadgeDefinition.values()) {
            String badgeId = def.getId();
            BadgeStatus status = badgeStatuses.get(badgeId);
            boolean earned = status != null && status.isAchievementState();
            LocalDateTime earnedAt = (status != null) ? status.getDate() : null;

            int progress = calculateBadgeProgress(def, totalParticipated, totalCreated, totalPoints, categoryCounts, user);

            Badge badge = Badge.builder()
                .id(def.getId())
                .name(isKorean ? def.getNameKo() : def.getNameEn())
                .description(isKorean ? def.getDescriptionKo() : def.getDescriptionEn())
                .icon(def.getIcon())
                .gradientColors(def.getGradientColors())
                .earnedAt(earned ? earnedAt : null)
                .progress(earned ? null : progress)
                .goal(earned ? null : def.getGoal())
                .build();

            if (earned) {
                earnedBadges.add(badge);
            } else {
                lockedBadges.add(badge);
            }
        }

        return BadgeInfo.builder()
            .earnedCount(earnedBadges.size())
            .totalCount(BadgeDefinition.values().length)
            .earnedBadges(earnedBadges)
            .lockedBadges(lockedBadges)
            .build();
    }

    /**
     * 배지 진행도 계산
     */
    private int calculateBadgeProgress(BadgeDefinition def, int totalParticipated, int totalCreated,
                                        int totalPoints, Map<String, Integer> categoryCounts, User user) {
        switch (def) {
            // 참여 배지
            case FIRST_MEETING:
            case MEETING_5:
            case MEETING_10:
            case MEETING_25:
            case MEETING_50:
                return totalParticipated;

            // 호스트 배지
            case FIRST_HOST:
            case HOST_5:
            case HOST_10:
                return totalCreated;

            // 출석 배지 (현재는 정확한 연속 출석 데이터가 없으므로 대략적으로)
            case PERFECT_ATTENDANCE_5:
            case PERFECT_ATTENDANCE_10:
                int attended = totalParticipated - (user.getAbsent() != 0 ? user.getAbsent() : 0);
                int onTime = attended - (user.getLate() != 0 ? user.getLate() : 0);
                return Math.max(0, onTime);

            // 평판 배지
            case WELL_RESPECTED:
                return categoryCounts.getOrDefault("RESPECT", 0);
            case GREAT_COMMUNICATOR:
                return categoryCounts.getOrDefault("COMMUNICATION", 0);
            case HIGHLY_ENGAGED:
                return categoryCounts.getOrDefault("ENGAGEMENT", 0);
            case WOULD_MEET_AGAIN:
                return categoryCounts.getOrDefault("REMATCH", 0);
            case RULE_KEEPER:
                return categoryCounts.getOrDefault("RULE_ADHERENCE", 0);
            case WELL_PREPARED:
                return categoryCounts.getOrDefault("PREPARATION", 0);

            // 종합 배지
            case ENDORSEMENT_MASTER:
                return totalPoints;

            default:
                return 0;
        }
    }

    /**
     * 최근 활동 타임라인 계산
     */
    private List<ActivityItem> calculateRecentActivities(User user, List<Post> participatedPosts, boolean isKorean) {
        List<ActivityItem> activities = new ArrayList<>();

        // 참여한 포스트들을 활동으로 변환 (최근 10개)
        List<Post> sortedPosts = participatedPosts.stream()
            .filter(p -> p.getDue() != null)
            .sorted((a, b) -> b.getDue().compareTo(a.getDue()))
            .limit(10)
            .collect(Collectors.toList());

        for (Post post : sortedPosts) {
            String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Unknown Book";
            int participantCount = post.getMemberIds() != null ? post.getMemberIds().size() : 0;

            activities.add(ActivityItem.builder()
                .type("MEETING")
                .title(bookTitle)
                .description(isKorean ? "독서 토론에 참여했습니다" : "Participated in book discussion")
                .icon("FiBookOpen")
                .gradientColors("#3B82F6,#1D4ED8")
                .timestamp(post.getDue())
                .rating(null) // 개별 미팅 평점은 현재 저장되지 않음
                .participantCount(participantCount)
                .postId(post.getId())
                .build());
        }

        return activities;
    }

    /**
     * 월별 출석 기록 계산 (최근 12개월)
     */
    private List<MonthlyAttendance> calculateMonthlyAttendance(List<Post> participatedPosts, boolean isKorean) {
        List<MonthlyAttendance> monthlyData = new ArrayList<>();

        // 최근 12개월
        YearMonth now = YearMonth.now();
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");

        for (int i = 11; i >= 0; i--) {
            YearMonth month = now.minusMonths(i);
            String monthKey = month.format(monthFormatter);
            String monthLabel = isKorean
                ? month.getMonthValue() + "월"
                : month.format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH));

            // 해당 월의 참여 포스트 수
            long attended = participatedPosts.stream()
                .filter(p -> p.getDue() != null)
                .filter(p -> YearMonth.from(p.getDue()).equals(month))
                .count();

            // 현재 데이터 구조로는 월별 지각/불참을 구분할 수 없음
            // 전체 absent/late를 월별로 분배하지 않고 0으로 표시
            monthlyData.add(MonthlyAttendance.builder()
                .month(monthKey)
                .monthLabel(monthLabel)
                .attended((int) attended)
                .late(0)  // 월별 데이터 없음
                .absent(0)  // 월별 데이터 없음
                .total((int) attended)
                .build());
        }

        return monthlyData;
    }

    /**
     * 사용자가 참여한 포스트들 조회
     */
    private List<Post> getParticipatedPosts(User user) {
        if (user.getPosts() == null || user.getPosts().getParticipated() == null) {
            return new ArrayList<>();
        }
        List<String> postIds = user.getPosts().getParticipated();
        if (postIds.isEmpty()) {
            return new ArrayList<>();
        }
        return postRepository.findAllById(postIds);
    }

    /**
     * 사용자가 생성한 포스트들 조회
     */
    private List<Post> getCreatedPosts(User user) {
        if (user.getPosts() == null || user.getPosts().getCreated() == null) {
            return new ArrayList<>();
        }
        List<String> postIds = user.getPosts().getCreated();
        if (postIds.isEmpty()) {
            return new ArrayList<>();
        }
        return postRepository.findAllById(postIds);
    }
}
