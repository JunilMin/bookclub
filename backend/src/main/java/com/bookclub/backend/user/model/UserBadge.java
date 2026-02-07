package com.bookclub.backend.user.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 사용자 배지 정보를 저장하는 MongoDB 컬렉션
 * 각 사용자당 하나의 문서가 생성됨
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "badges")
public class UserBadge {

    @Id
    private String id;

    /**
     * 사용자 ID (참조)
     */
    @Indexed(unique = true)
    private String userId;

    /**
     * 배지별 달성 상태
     * key: 배지 ID (BadgeDefinition의 id)
     * value: BadgeStatus (달성 상태 및 날짜)
     */
    @Builder.Default
    private Map<String, BadgeStatus> badges = new HashMap<>();

    /**
     * 문서 생성 시간
     */
    private LocalDateTime createdAt;

    /**
     * 마지막 업데이트 시간
     */
    private LocalDateTime updatedAt;

    /**
     * 개별 배지의 달성 상태
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BadgeStatus {
        /**
         * 달성 여부 (true: 완료, false: 미완료)
         */
        @Builder.Default
        private boolean achievementState = false;

        /**
         * 달성 날짜 (미완료 시 null)
         */
        private LocalDateTime date;
    }

    /**
     * 새 사용자를 위한 기본 배지 문서 생성
     */
    public static UserBadge createDefault(String userId) {
        Map<String, BadgeStatus> defaultBadges = new HashMap<>();

        // 모든 배지를 미달성 상태로 초기화
        // 참여 배지
        defaultBadges.put("first_meeting", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("meeting_5", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("meeting_10", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("meeting_25", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("meeting_50", BadgeStatus.builder().achievementState(false).date(null).build());
        // 호스트 배지
        defaultBadges.put("first_host", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("host_5", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("host_10", BadgeStatus.builder().achievementState(false).date(null).build());
        // 출석 배지
        defaultBadges.put("perfect_5", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("perfect_10", BadgeStatus.builder().achievementState(false).date(null).build());
        // 평판 배지
        defaultBadges.put("well_respected", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("great_communicator", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("highly_engaged", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("would_meet_again", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("rule_keeper", BadgeStatus.builder().achievementState(false).date(null).build());
        defaultBadges.put("well_prepared", BadgeStatus.builder().achievementState(false).date(null).build());
        // 종합 배지
        defaultBadges.put("endorsement_master", BadgeStatus.builder().achievementState(false).date(null).build());

        return UserBadge.builder()
                .userId(userId)
                .badges(defaultBadges)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
