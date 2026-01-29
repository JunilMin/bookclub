package com.bookclub.backend.user;

import com.bookclub.backend.endorsement.EndorsementRepository;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.model.AttendanceRecord;
import com.bookclub.backend.session.model.AttendanceRecord.AttendanceStatus;
import com.bookclub.backend.session.model.AttendanceRecord.AttendanceType;
import com.bookclub.backend.session.repository.AttendanceRecordRepository;
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

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private EndorsementRepository endorsementRepository;

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

        // 배지 정보 조회 (활동 타임라인에서도 사용)
        UserBadge userBadge = userBadgeService.checkAndUpdateBadges(user.getId());

        return UserReputationResponse.builder()
            .userId(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .photoUrl(user.getDisplayPhotoUrl())
            .joinedAt(user.getCreatedAt())
            .participationStats(calculateParticipationStats(user, participatedPosts, createdPosts))
            .endorsementStats(calculateEndorsementStats(user))
            .badgeInfo(calculateBadgeInfo(user, participatedPosts, createdPosts, isKorean, userBadge))
            .recentActivities(calculateRecentActivities(user, participatedPosts, createdPosts, userBadge, isKorean))
            .monthlyAttendance(calculateMonthlyAttendance(user, participatedPosts, createdPosts, isKorean))
            .build();
    }

    /**
     * 참여 통계 계산 (attendance_records 기반)
     */
    private ParticipationStats calculateParticipationStats(User user, List<Post> participatedPosts, List<Post> createdPosts) {
        String odUserId = user.getId();
        int kicked = user.getKicked() != 0 ? user.getKicked() : 0;

        // 생성한 포스트 ID 목록
        List<String> createdPostIds = createdPosts.stream()
            .map(Post::getId)
            .collect(Collectors.toList());

        // 참여한 포스트 ID 목록
        List<String> participatedPostIds = participatedPosts.stream()
            .map(Post::getId)
            .collect(Collectors.toList());

        // 모든 포스트 ID (생성 + 참여)
        Set<String> allPostIds = new HashSet<>();
        allPostIds.addAll(createdPostIds);
        allPostIds.addAll(participatedPostIds);

        int totalMeetings = allPostIds.size();

        // 각 통계 초기화
        int createdAndAttended = 0;  // 생성&참여: created에서 CONFIRMED
        int participated = 0;        // 참여: participated에서 CONFIRMED
        int absent = 0;              // 불참: 기록 없음 OR status != CONFIRMED
        int late = 0;                // 지각: attendanceType == LATE
        int onTimeCount = 0;         // 정시/일찍: EARLY or ON_TIME

        // 생성한 포스트에 대한 출석 기록 확인
        for (String postId : createdPostIds) {
            Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(postId, odUserId);

            if (recordOpt.isPresent()) {
                AttendanceRecord record = recordOpt.get();
                if (record.getStatus() == AttendanceStatus.CONFIRMED) {
                    createdAndAttended++;

                    // 지각/정시 체크
                    if (record.getAttendanceType() == AttendanceType.LATE) {
                        late++;
                    } else if (record.getAttendanceType() == AttendanceType.EARLY ||
                               record.getAttendanceType() == AttendanceType.ON_TIME) {
                        onTimeCount++;
                    }
                } else {
                    absent++;
                }
            } else {
                // 출석 기록이 없으면 불참
                absent++;
            }
        }

        // 참여한 포스트에 대한 출석 기록 확인 (생성 포스트와 중복 제외)
        for (String postId : participatedPostIds) {
            // 이미 생성 포스트로 처리된 경우 건너뛰기
            if (createdPostIds.contains(postId)) {
                continue;
            }

            Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(postId, odUserId);

            if (recordOpt.isPresent()) {
                AttendanceRecord record = recordOpt.get();
                if (record.getStatus() == AttendanceStatus.CONFIRMED) {
                    participated++;

                    // 지각/정시 체크
                    if (record.getAttendanceType() == AttendanceType.LATE) {
                        late++;
                    } else if (record.getAttendanceType() == AttendanceType.EARLY ||
                               record.getAttendanceType() == AttendanceType.ON_TIME) {
                        onTimeCount++;
                    }
                } else {
                    absent++;
                }
            } else {
                // 출석 기록이 없으면 불참
                absent++;
            }
        }

        // 총 확정 출석 수
        int totalConfirmed = createdAndAttended + participated;

        // 출석률 = (confirmed / total) * 100
        double attendanceRate = totalMeetings > 0 ? ((double) totalConfirmed / totalMeetings) * 100 : 100;

        // 정시 출석률 = (EARLY + ON_TIME) / confirmed * 100
        double onTimeRate = totalConfirmed > 0 ? ((double) onTimeCount / totalConfirmed) * 100 : 100;

        // 연속 참여 기록 계산 (불참 없이 연속 참석한 횟수)
        int currentStreak = calculateCurrentStreak(user, participatedPosts, createdPosts);

        // 피드백 통계 계산
        int feedbackGivenCount = (int) endorsementRepository.countByEvaluatorUserId(odUserId);
        int feedbackReceivedCount = 0;
        if (user.getEndorsementStats() != null) {
            feedbackReceivedCount = user.getEndorsementStats().getCount() != 0 ? user.getEndorsementStats().getCount() : 0;
        }

        // 피드백 가능 인원 계산 (참석한 모든 토론의 (참가자 수 - 1)의 합)
        int feedbackPossibleCount = calculateFeedbackPossibleCount(user, participatedPosts, createdPosts);

        return ParticipationStats.builder()
            .createdAndAttended(createdAndAttended)
            .participated(participated)
            .absent(absent)
            .late(late)
            .kicked(kicked)
            .totalMeetings(totalMeetings)
            .attendanceRate(Math.round(attendanceRate * 10) / 10.0)
            .onTimeRate(Math.round(onTimeRate * 10) / 10.0)
            // Profile card 통계
            .totalConfirmed(totalConfirmed)
            .onTimeCount(onTimeCount)
            .currentStreak(currentStreak)
            .feedbackGivenCount(feedbackGivenCount)
            .feedbackPossibleCount(feedbackPossibleCount)
            .feedbackReceivedCount(feedbackReceivedCount)
            .build();
    }

    /**
     * 연속 참여 기록 계산 (최근 기준으로 불참 없이 연속 참석한 횟수)
     */
    private int calculateCurrentStreak(User user, List<Post> participatedPosts, List<Post> createdPosts) {
        String odUserId = user.getId();

        // 모든 포스트 합치기 (중복 제거)
        Map<String, Post> allPostsMap = new HashMap<>();
        for (Post post : createdPosts) {
            allPostsMap.put(post.getId(), post);
        }
        for (Post post : participatedPosts) {
            allPostsMap.put(post.getId(), post);
        }

        // due 날짜 기준 최신순 정렬 (가장 최근 먼저)
        List<Post> sortedPosts = allPostsMap.values().stream()
            .filter(p -> p.getDue() != null)
            .sorted((a, b) -> b.getDue().compareTo(a.getDue()))
            .collect(Collectors.toList());

        int streak = 0;
        for (Post post : sortedPosts) {
            Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(post.getId(), odUserId);

            if (recordOpt.isPresent() && recordOpt.get().getStatus() == AttendanceStatus.CONFIRMED) {
                // 참석 확인됨 - streak 계속
                streak++;
            } else {
                // 불참 - streak 종료
                break;
            }
        }

        return streak;
    }

    /**
     * 피드백 가능 인원 계산 (참석한 모든 토론의 (참가자 수 - 1)의 합)
     */
    private int calculateFeedbackPossibleCount(User user, List<Post> participatedPosts, List<Post> createdPosts) {
        String odUserId = user.getId();

        // 모든 포스트 합치기 (중복 제거)
        Map<String, Post> allPostsMap = new HashMap<>();
        for (Post post : createdPosts) {
            allPostsMap.put(post.getId(), post);
        }
        for (Post post : participatedPosts) {
            allPostsMap.put(post.getId(), post);
        }

        int totalPossible = 0;
        for (Post post : allPostsMap.values()) {
            // 내가 참석(CONFIRMED)한 포스트만 계산
            Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(post.getId(), odUserId);

            if (recordOpt.isPresent() && recordOpt.get().getStatus() == AttendanceStatus.CONFIRMED) {
                // 참가자 수 - 1 (자기 자신 제외)
                int memberCount = post.getMemberIds() != null ? post.getMemberIds().size() : 0;
                totalPossible += Math.max(0, memberCount - 1);
            }
        }

        return totalPossible;
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
    private BadgeInfo calculateBadgeInfo(User user, List<Post> participatedPosts, List<Post> createdPosts, boolean isKorean, UserBadge userBadge) {
        List<Badge> earnedBadges = new ArrayList<>();
        List<Badge> lockedBadges = new ArrayList<>();

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
     * - 회원가입, 포스트 참석, 배지 획득, 포스트 생성
     */
    private List<ActivityItem> calculateRecentActivities(User user, List<Post> participatedPosts, List<Post> createdPosts, UserBadge userBadge, boolean isKorean) {
        List<ActivityItem> activities = new ArrayList<>();
        String odUserId = user.getId();

        // 1. 회원가입 활동
        if (user.getCreatedAt() != null) {
            activities.add(ActivityItem.builder()
                .type("SIGNUP")
                .title(isKorean ? "북클럽 가입" : "Joined BookClub")
                .description(isKorean ? "북클럽에 가입했습니다" : "Joined BookClub community")
                .icon("ri-user-add-fill")
                .gradientColors("#10B981,#059669")
                .timestamp(user.getCreatedAt())
                .rating(null)
                .participantCount(null)
                .postId(null)
                .build());
        }

        // 2. 포스트 생성 활동
        for (Post post : createdPosts) {
            if (post.getDate() != null) {
                String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Unknown Book";

                activities.add(ActivityItem.builder()
                    .type("CREATED")
                    .title(bookTitle)
                    .description(isKorean ? "북미팅을 생성했습니다" : "Created a book meeting")
                    .icon("ri-add-circle-fill")
                    .gradientColors("#8B5CF6,#7C3AED")
                    .timestamp(post.getDate())
                    .rating(null)
                    .participantCount(post.getMemberIds() != null ? post.getMemberIds().size() : 0)
                    .postId(post.getId())
                    .build());
            }
        }

        // 3. 포스트 참석 활동 (attendance_records 기반)
        // 모든 포스트 합치기 (중복 제거)
        Map<String, Post> allPostsMap = new HashMap<>();
        for (Post post : createdPosts) {
            allPostsMap.put(post.getId(), post);
        }
        for (Post post : participatedPosts) {
            allPostsMap.put(post.getId(), post);
        }

        for (Post post : allPostsMap.values()) {
            Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(post.getId(), odUserId);

            if (recordOpt.isPresent()) {
                AttendanceRecord record = recordOpt.get();
                if (record.getStatus() == AttendanceStatus.CONFIRMED && record.getCreatedAt() != null) {
                    String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Unknown Book";
                    boolean isLate = record.getAttendanceType() == AttendanceType.LATE;

                    activities.add(ActivityItem.builder()
                        .type("ATTENDED")
                        .title(bookTitle)
                        .description(isLate
                            ? (isKorean ? "북미팅에 늦게 참석했습니다" : "Attended book meeting (late)")
                            : (isKorean ? "북미팅에 참석했습니다" : "Attended book meeting"))
                        .icon(isLate ? "ri-time-fill" : "ri-checkbox-circle-fill")
                        .gradientColors(isLate ? "#F59E0B,#D97706" : "#3B82F6,#2563EB")
                        .timestamp(record.getCreatedAt())
                        .rating(null)
                        .participantCount(post.getMemberIds() != null ? post.getMemberIds().size() : 0)
                        .postId(post.getId())
                        .build());
                }
            }
        }

        // 4. 배지 획득 활동
        if (userBadge != null && userBadge.getBadges() != null) {
            for (Map.Entry<String, BadgeStatus> entry : userBadge.getBadges().entrySet()) {
                BadgeStatus status = entry.getValue();
                if (status != null && status.isAchievementState() && status.getDate() != null) {
                    String badgeId = entry.getKey();

                    // BadgeDefinition에서 배지 정보 가져오기
                    BadgeDefinition badgeDef = null;
                    for (BadgeDefinition def : BadgeDefinition.values()) {
                        if (def.getId().equals(badgeId)) {
                            badgeDef = def;
                            break;
                        }
                    }

                    if (badgeDef != null) {
                        activities.add(ActivityItem.builder()
                            .type("BADGE")
                            .title(isKorean ? badgeDef.getNameKo() : badgeDef.getNameEn())
                            .description(isKorean ? "배지를 획득했습니다" : "Earned a badge")
                            .icon(badgeDef.getIcon())
                            .gradientColors(badgeDef.getGradientColors()) // Tailwind 형식 그대로 전달, 프론트엔드에서 변환
                            .timestamp(status.getDate())
                            .rating(null)
                            .participantCount(null)
                            .postId(null)
                            .build());
                    }
                }
            }
        }

        // 최신순 정렬 (위에서 아래로 최근 → 이전)
        activities.sort((a, b) -> {
            if (a.getTimestamp() == null && b.getTimestamp() == null) return 0;
            if (a.getTimestamp() == null) return 1;
            if (b.getTimestamp() == null) return -1;
            return b.getTimestamp().compareTo(a.getTimestamp());
        });

        return activities;
    }

    /**
     * 월별 출석 기록 계산 (최근 12개월, attendance_records 기반)
     */
    private List<MonthlyAttendance> calculateMonthlyAttendance(User user, List<Post> participatedPosts, List<Post> createdPosts, boolean isKorean) {
        List<MonthlyAttendance> monthlyData = new ArrayList<>();
        String odUserId = user.getId();

        // 모든 포스트 합치기 (중복 제거)
        Map<String, Post> allPostsMap = new HashMap<>();
        for (Post post : createdPosts) {
            allPostsMap.put(post.getId(), post);
        }
        for (Post post : participatedPosts) {
            allPostsMap.put(post.getId(), post);
        }

        // 최근 12개월
        YearMonth now = YearMonth.now();
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");

        for (int i = 11; i >= 0; i--) {
            YearMonth month = now.minusMonths(i);
            String monthKey = month.format(monthFormatter);
            String monthLabel = isKorean
                ? month.getMonthValue() + "월"
                : month.format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH));

            int attended = 0;  // 참석 (CONFIRMED, 지각 제외)
            int late = 0;      // 지각 (CONFIRMED + LATE)
            int absent = 0;    // 불참 (기록 없음 OR status != CONFIRMED)

            // 해당 월의 포스트들 필터링
            List<Post> monthPosts = allPostsMap.values().stream()
                .filter(p -> p.getDue() != null)
                .filter(p -> YearMonth.from(p.getDue()).equals(month))
                .collect(Collectors.toList());

            for (Post post : monthPosts) {
                Optional<AttendanceRecord> recordOpt = attendanceRecordRepository.findByPostIdAndUserId(post.getId(), odUserId);

                if (recordOpt.isPresent()) {
                    AttendanceRecord record = recordOpt.get();
                    if (record.getStatus() == AttendanceStatus.CONFIRMED) {
                        if (record.getAttendanceType() == AttendanceType.LATE) {
                            late++;
                        } else {
                            attended++;
                        }
                    } else {
                        absent++;
                    }
                } else {
                    absent++;
                }
            }

            int total = attended + late + absent;

            monthlyData.add(MonthlyAttendance.builder()
                .month(monthKey)
                .monthLabel(monthLabel)
                .attended(attended)
                .late(late)
                .absent(absent)
                .total(total)
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
