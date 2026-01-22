package com.bookclub.backend.user.service;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.user.BadgeDefinition;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.bookclub.backend.user.model.UserBadge;
import com.bookclub.backend.user.model.UserBadge.BadgeStatus;
import com.bookclub.backend.user.repository.UserBadgeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 사용자 배지 관리 서비스
 * 배지 달성 여부 확인 및 부여
 */
@Service
public class UserBadgeService {

    @Autowired
    private UserBadgeRepository userBadgeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    /**
     * 사용자의 배지 문서 조회 (없으면 생성)
     */
    public UserBadge getUserBadges(String userId) {
        return userBadgeRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserBadge newBadge = UserBadge.createDefault(userId);
                    return userBadgeRepository.save(newBadge);
                });
    }

    /**
     * 사용자의 배지 달성 상태 확인 및 업데이트
     * 모든 배지에 대해 달성 조건을 확인하고 새로 달성한 배지가 있으면 업데이트
     */
    public UserBadge checkAndUpdateBadges(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + userId));

        UserBadge userBadge = getUserBadges(userId);

        // 참여/생성 데이터 조회
        List<Post> participatedPosts = getParticipatedPosts(user);
        List<Post> createdPosts = getCreatedPosts(user);

        int totalParticipated = participatedPosts.size();
        int totalCreated = createdPosts.size();

        // Endorsement 데이터
        User.EndorsementStats endorsementStats = user.getEndorsementStats();
        Map<String, Integer> categoryCounts = new HashMap<>();
        int totalPoints = 0;

        if (endorsementStats != null) {
            totalPoints = endorsementStats.getPoints() != 0 ? endorsementStats.getPoints() : 0;
            if (endorsementStats.getCategoryCounts() != null) {
                categoryCounts = endorsementStats.getCategoryCounts();
            }
        }

        // 출석 관련 데이터
        int absent = user.getAbsent() != 0 ? user.getAbsent() : 0;
        int late = user.getLate() != 0 ? user.getLate() : 0;
        int attended = Math.max(0, totalParticipated - absent);
        int onTime = Math.max(0, attended - late);

        boolean updated = false;
        Map<String, BadgeStatus> badges = userBadge.getBadges();

        // 각 배지에 대해 달성 여부 확인
        for (BadgeDefinition def : BadgeDefinition.values()) {
            String badgeId = def.getId();
            BadgeStatus status = badges.getOrDefault(badgeId, BadgeStatus.builder().achievementState(false).date(null).build());

            // 이미 달성한 배지는 스킵
            if (status.isAchievementState()) {
                continue;
            }

            int progress = calculateProgress(def, totalParticipated, totalCreated, totalPoints, categoryCounts, onTime);
            boolean achieved = progress >= def.getGoal();

            if (achieved) {
                status.setAchievementState(true);
                status.setDate(LocalDateTime.now());
                badges.put(badgeId, status);
                updated = true;
            }
        }

        if (updated) {
            userBadge.setUpdatedAt(LocalDateTime.now());
            userBadgeRepository.save(userBadge);
        }

        return userBadge;
    }

    /**
     * 특정 배지 수동 부여
     */
    public UserBadge awardBadge(String userId, String badgeId) {
        UserBadge userBadge = getUserBadges(userId);

        BadgeStatus status = userBadge.getBadges().getOrDefault(badgeId,
                BadgeStatus.builder().achievementState(false).date(null).build());

        if (!status.isAchievementState()) {
            status.setAchievementState(true);
            status.setDate(LocalDateTime.now());
            userBadge.getBadges().put(badgeId, status);
            userBadge.setUpdatedAt(LocalDateTime.now());
            userBadgeRepository.save(userBadge);
        }

        return userBadge;
    }

    /**
     * 특정 배지 회수
     */
    public UserBadge revokeBadge(String userId, String badgeId) {
        UserBadge userBadge = getUserBadges(userId);

        BadgeStatus status = userBadge.getBadges().get(badgeId);
        if (status != null && status.isAchievementState()) {
            status.setAchievementState(false);
            status.setDate(null);
            userBadge.getBadges().put(badgeId, status);
            userBadge.setUpdatedAt(LocalDateTime.now());
            userBadgeRepository.save(userBadge);
        }

        return userBadge;
    }

    /**
     * 획득한 배지 목록 조회
     */
    public List<String> getEarnedBadgeIds(String userId) {
        UserBadge userBadge = getUserBadges(userId);
        List<String> earnedIds = new ArrayList<>();

        for (Map.Entry<String, BadgeStatus> entry : userBadge.getBadges().entrySet()) {
            if (entry.getValue().isAchievementState()) {
                earnedIds.add(entry.getKey());
            }
        }

        return earnedIds;
    }

    /**
     * 획득한 배지 수 조회
     */
    public int getEarnedBadgeCount(String userId) {
        return getEarnedBadgeIds(userId).size();
    }

    /**
     * 배지 달성 진행도 계산
     */
    private int calculateProgress(BadgeDefinition def, int totalParticipated, int totalCreated,
                                  int totalPoints, Map<String, Integer> categoryCounts, int onTime) {
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

            // 출석 배지
            case PERFECT_ATTENDANCE_5:
            case PERFECT_ATTENDANCE_10:
                return onTime;

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
