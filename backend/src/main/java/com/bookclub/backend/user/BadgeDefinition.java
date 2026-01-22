package com.bookclub.backend.user;

import lombok.Getter;

/**
 * 시스템에서 제공하는 배지 정의
 * 사용자 활동에 따라 자동으로 부여됨
 */
@Getter
public enum BadgeDefinition {

    // 참여 관련 배지
    FIRST_MEETING("first_meeting", "첫 토론 완료", "First Discussion",
        "첫 번째 북클럽 토론 참여", "Participated in your first discussion",
        "ri-star-fill", "from-yellow-400 to-yellow-600", 1, BadgeCategory.PARTICIPATION),

    MEETING_5("meeting_5", "토론 애호가", "Discussion Lover",
        "5회 이상 토론 참여", "Participated in 5+ discussions",
        "ri-book-open-fill", "from-blue-400 to-blue-600", 5, BadgeCategory.PARTICIPATION),

    MEETING_10("meeting_10", "열정적인 독자", "Passionate Reader",
        "10회 이상 토론 참여", "Participated in 10+ discussions",
        "ri-fire-fill", "from-orange-400 to-red-600", 10, BadgeCategory.PARTICIPATION),

    MEETING_25("meeting_25", "토론 마스터", "Discussion Master",
        "25회 이상 토론 참여", "Participated in 25+ discussions",
        "ri-award-fill", "from-purple-400 to-purple-600", 25, BadgeCategory.PARTICIPATION),

    MEETING_50("meeting_50", "베테랑 멤버", "Veteran Member",
        "50회 이상 토론 참여", "Participated in 50+ discussions",
        "ri-trophy-fill", "from-amber-400 to-amber-600", 50, BadgeCategory.PARTICIPATION),

    // 호스트 관련 배지
    FIRST_HOST("first_host", "사회자 데뷔", "First Host",
        "첫 토론 사회자 경험", "Hosted your first discussion",
        "ri-user-star-fill", "from-indigo-400 to-indigo-600", 1, BadgeCategory.HOSTING),

    HOST_5("host_5", "신뢰받는 호스트", "Trusted Host",
        "5회 이상 토론 주최", "Hosted 5+ discussions",
        "ri-vip-crown-fill", "from-teal-400 to-teal-600", 5, BadgeCategory.HOSTING),

    HOST_10("host_10", "베테랑 호스트", "Veteran Host",
        "10회 이상 토론 주최", "Hosted 10+ discussions",
        "ri-vip-crown-2-fill", "from-violet-400 to-violet-600", 10, BadgeCategory.HOSTING),

    // 출석 관련 배지
    PERFECT_ATTENDANCE_5("perfect_5", "꾸준한 출석", "Consistent Attendee",
        "5회 연속 정시 출석", "5 consecutive on-time attendances",
        "ri-calendar-check-fill", "from-emerald-400 to-emerald-600", 5, BadgeCategory.ATTENDANCE),

    PERFECT_ATTENDANCE_10("perfect_10", "완벽한 출석", "Perfect Attendance",
        "10회 연속 정시 출석", "10 consecutive on-time attendances",
        "ri-flashlight-fill", "from-lime-400 to-lime-600", 10, BadgeCategory.ATTENDANCE),

    // 평판 관련 배지
    WELL_RESPECTED("well_respected", "존중의 아이콘", "Respect Icon",
        "존중 점수 10점 이상 달성", "Received 10+ respect endorsements",
        "ri-shield-star-fill", "from-teal-400 to-teal-600", 10, BadgeCategory.REPUTATION),

    GREAT_COMMUNICATOR("great_communicator", "소통의 달인", "Communication Master",
        "소통 점수 10점 이상 달성", "Received 10+ communication endorsements",
        "ri-chat-3-fill", "from-blue-400 to-blue-600", 10, BadgeCategory.REPUTATION),

    HIGHLY_ENGAGED("highly_engaged", "참여왕", "Engagement King",
        "참여도 점수 10점 이상 달성", "Received 10+ engagement endorsements",
        "ri-rocket-fill", "from-orange-400 to-orange-600", 10, BadgeCategory.REPUTATION),

    WOULD_MEET_AGAIN("would_meet_again", "인기 멤버", "Popular Member",
        "재참여의향 점수 10점 이상", "Received 10+ rematch endorsements",
        "ri-heart-fill", "from-rose-400 to-rose-600", 10, BadgeCategory.REPUTATION),

    // 규칙 준수 배지
    RULE_KEEPER("rule_keeper", "규칙 수호자", "Rule Keeper",
        "규칙준수 점수 10점 이상", "Received 10+ rule adherence endorsements",
        "ri-shield-check-fill", "from-cyan-400 to-cyan-600", 10, BadgeCategory.REPUTATION),

    // 준비성 배지
    WELL_PREPARED("well_prepared", "준비왕", "Well Prepared",
        "준비성 점수 10점 이상 유지", "Received 10+ preparation endorsements",
        "ri-medal-fill", "from-pink-400 to-pink-600", 10, BadgeCategory.REPUTATION),

    // 종합 배지
    ENDORSEMENT_MASTER("endorsement_master", "평판의 달인", "Endorsement Master",
        "총 50점 이상의 endorsement 획득", "Received 50+ total endorsement points",
        "ri-award-line", "from-yellow-400 to-amber-600", 50, BadgeCategory.OVERALL);

    private final String id;
    private final String nameKo;
    private final String nameEn;
    private final String descriptionKo;
    private final String descriptionEn;
    private final String icon;
    private final String gradientColors;
    private final int goal;
    private final BadgeCategory category;

    BadgeDefinition(String id, String nameKo, String nameEn,
                    String descriptionKo, String descriptionEn,
                    String icon, String gradientColors, int goal, BadgeCategory category) {
        this.id = id;
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.descriptionKo = descriptionKo;
        this.descriptionEn = descriptionEn;
        this.icon = icon;
        this.gradientColors = gradientColors;
        this.goal = goal;
        this.category = category;
    }

    public enum BadgeCategory {
        PARTICIPATION,
        HOSTING,
        ATTENDANCE,
        REPUTATION,
        OVERALL
    }
}
