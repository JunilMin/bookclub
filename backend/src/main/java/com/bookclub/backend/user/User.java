// ./user/User.java
package com.bookclub.backend.user;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "user")
@Getter // 세터 생성
@Setter // 게터 생성
@NoArgsConstructor  // 기본 생성자 생성
public class User {
  @Id
  private String id;
  private String uid;
  private String email;
  private String username;
  private String password;
  private int rating;
  private int absent;
  private List<String> friends;
  private int late;
  private int kicked;  // 강퇴 당한 횟수
  private UserPosts posts;  // 북미팅 관련 필드 (생성/참여)
  private String photoUrl;  // [Legacy] Google 프로필 사진 URL - 마이그레이션 후 제거 예정
  private String customPhotoUrl;  // [Legacy] 커스텀 사진 URL - 마이그레이션 후 제거 예정
  private Photo photo;  // 프로필 사진 (Google + Custom)
  private LocalDateTime createdAt;  // 회원가입 날짜

  // Legacy fields for backward compatibility (MongoDB에 저장된 기존 데이터 읽기용)
  // 이 필드들은 MongoDB에서 읽기만 하고, 저장할 때는 posts 필드를 사용
  private List<String> createdBookMeetings;
  private List<String> participatedBookMeetings;

  /**
   * posts getter - legacy 필드 마이그레이션 지원
   * 1. posts가 null이고 legacy 필드가 있으면 자동 변환
   * 2. posts도 null이고 legacy 필드도 null이면 빈 UserPosts 생성
   * 항상 non-null 반환 보장
   */
  public UserPosts getPosts() {
    if (this.posts == null) {
      if (this.createdBookMeetings != null || this.participatedBookMeetings != null) {
        // Legacy 필드에서 마이그레이션
        this.posts = new UserPosts(this.createdBookMeetings, this.participatedBookMeetings);
      } else {
        // Legacy 필드도 없으면 빈 객체 생성
        this.posts = new UserPosts(new ArrayList<>(), new ArrayList<>());
      }
    }
    return this.posts;
  }

  // 북미팅 관련 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class UserPosts {
    private List<String> created;      // 내가 생성한 북미팅 ID 리스트
    private List<String> participated; // 참여한 북미팅 ID 리스트 (지난/현재 모두)

    public UserPosts(List<String> created, List<String> participated) {
      this.created = created != null ? created : new ArrayList<>();
      this.participated = participated != null ? participated : new ArrayList<>();
    }
  }

  // 신고 관련 집계 필드
  private ReportedStats reported;

  // 평가(endorsement) 관련 집계 필드
  private EndorsementStats endorsementStats;

  // 관심 도서 (좋아요 + AI 추천)
  private Fav fav;

  // 프로필 설정 (관심사 탭)
  private UserProfile profile;

  // 사용자 설정
  private UserSetting setting;

  /**
   * fav getter - null 방지
   */
  public Fav getFav() {
    if (this.fav == null) {
      this.fav = new Fav();
    }
    return this.fav;
  }

  /**
   * profile getter - null 방지
   */
  public UserProfile getProfile() {
    if (this.profile == null) {
      this.profile = new UserProfile();
    }
    return this.profile;
  }

  /**
   * setting getter - null 방지
   */
  public UserSetting getSetting() {
    if (this.setting == null) {
      this.setting = new UserSetting();
    }
    return this.setting;
  }

  /**
   * photo getter - legacy photoUrl 마이그레이션 지원
   * 1. photo가 null이고 photoUrl이 있으면 자동 변환
   * 2. photo도 null이고 photoUrl도 null이면 빈 Photo 생성
   */
  public Photo getPhoto() {
    if (this.photo == null) {
      this.photo = new Photo();
      // Legacy photoUrl 마이그레이션
      if (this.photoUrl != null) {
        this.photo.setGoogle(this.photoUrl);
      }
      // Legacy customPhotoUrl 마이그레이션
      if (this.customPhotoUrl != null) {
        this.photo.setCustom(this.customPhotoUrl);
      }
    }
    return this.photo;
  }

  /**
   * 프로필 사진 URL 가져오기 (custom 우선, 없으면 google)
   */
  public String getDisplayPhotoUrl() {
    Photo p = getPhoto();
    if (p.getCustom() != null && !p.getCustom().isEmpty()) {
      return p.getCustom();
    }
    return p.getGoogle();
  }

  // 관심 도서 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Fav {
    private List<UserFavorite> user;    // 사용자가 좋아요한 책
    private List<AIRecommendation> ai;  // AI 추천 책

    public List<UserFavorite> getUser() {
      if (this.user == null) {
        this.user = new ArrayList<>();
      }
      return this.user;
    }

    public List<AIRecommendation> getAi() {
      if (this.ai == null) {
        this.ai = new ArrayList<>();
      }
      return this.ai;
    }
  }

  // 사용자 좋아요 책
  @Getter
  @Setter
  @NoArgsConstructor
  public static class UserFavorite {
    private String isbn;
    private LocalDateTime likedAt;

    public UserFavorite(String isbn) {
      this.isbn = isbn;
      this.likedAt = LocalDateTime.now();
    }
  }

  // AI 추천 책
  @Getter
  @Setter
  @NoArgsConstructor
  public static class AIRecommendation {
    private String isbn;
    private String reason;
    private LocalDateTime recommendedAt;

    public AIRecommendation(String isbn, String reason) {
      this.isbn = isbn;
      this.reason = reason;
      this.recommendedAt = LocalDateTime.now();
    }
  }

  // 신고 통계 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class ReportedStats {
    private int count;                           // 총 신고 당한 횟수
    private LocalDateTime lastReportedAt;        // 마지막 신고 당한 시간
    private Map<String, Integer> reasonCounts;   // 사유별 신고 횟수

    public ReportedStats(int count) {
      this.count = count;
      this.reasonCounts = new HashMap<>();
    }

    public void incrementCount() {
      this.count++;
      this.lastReportedAt = LocalDateTime.now();
    }

    public void incrementReasonCount(String reason) {
      if (this.reasonCounts == null) {
        this.reasonCounts = new HashMap<>();
      }
      this.reasonCounts.merge(reason, 1, Integer::sum);
    }
  }

  // Endorsement 통계 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class EndorsementStats {
    private int count = 0;                          // 총 받은 endorsement 횟수
    private int points = 0;                         // 누적 점수
    private Map<String, Integer> categoryCounts;    // 카테고리별 받은 횟수
    private LocalDateTime lastEndorsedAt;           // 마지막 endorsement 받은 시간

    public EndorsementStats(int count) {
      this.count = count;
      this.points = 0;
      this.categoryCounts = new HashMap<>();
    }

    /**
     * Increment the total endorsement count.
     */
    public void incrementCount() {
      this.count++;
      this.lastEndorsedAt = LocalDateTime.now();
    }

    /**
     * Add points to the total.
     */
    public void addPoints(int pointsToAdd) {
      this.points += pointsToAdd;
    }

    /**
     * Increment the count for a specific category.
     */
    public void incrementCategory(String category) {
      if (this.categoryCounts == null) {
        this.categoryCounts = new HashMap<>();
      }
      this.categoryCounts.merge(category, 1, Integer::sum);
    }
  }

  // 프로필 설정 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class UserProfile {
    private Introduce introduce;

    public Introduce getIntroduce() {
      if (this.introduce == null) {
        this.introduce = new Introduce();
      }
      return this.introduce;
    }
  }

  // 자기소개 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Introduce {
    private String introduction;            // 소개글
    private List<String> preferredGenre;   // 선호 장르
    private Styles styles;                  // 스타일 설정
    private List<String> keywords;          // 관심 키워드
    private Goals goals;                    // 목표
    private Location location;              // 위치 정보

    public List<String> getPreferredGenre() {
      if (this.preferredGenre == null) {
        this.preferredGenre = new ArrayList<>();
      }
      return this.preferredGenre;
    }

    public Styles getStyles() {
      if (this.styles == null) {
        this.styles = new Styles();
      }
      return this.styles;
    }

    public List<String> getKeywords() {
      if (this.keywords == null) {
        this.keywords = new ArrayList<>();
      }
      return this.keywords;
    }

    public Goals getGoals() {
      if (this.goals == null) {
        this.goals = new Goals();
      }
      return this.goals;
    }
  }

  // 위치 정보 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Location {
    private String city;          // 도시
    private String country;       // 국가
    private String countryCode;   // 국가 코드
    private Double latitude;      // 위도
    private Double longitude;     // 경도
    private String updatedAt;     // 업데이트 시간
  }

  // 스타일 설정 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Styles {
    private String discussionStyle;   // 토론 스타일
    private String preferredTime;     // 선호 시간대
    private String preferredSize;     // 선호 인원
    private String useAI;             // AI 사용 여부
  }

  // 목표 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Goals {
    private int participate;   // 참여 목표
    private int create;        // 생성 목표
  }

  // 사용자 설정 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class UserSetting {
    private Visibility visibility;    // 공개 설정
    private String loginType;         // 로그인 타입 (google|email)
    private boolean deleted;          // 삭제 여부

    public Visibility getVisibility() {
      if (this.visibility == null) {
        this.visibility = new Visibility();
      }
      return this.visibility;
    }
  }

  // 공개 설정 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Visibility {
    private String scope;                    // public|users|private
    private VisibilityElements elements;     // 요소별 공개 설정

    public VisibilityElements getElements() {
      if (this.elements == null) {
        this.elements = new VisibilityElements();
      }
      return this.elements;
    }
  }

  // 공개 요소 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class VisibilityElements {
    private boolean email = true;
    private boolean location = true;
    private boolean activeStatus = true;
  }

  // 프로필 사진 내부 클래스
  @Getter
  @Setter
  @NoArgsConstructor
  public static class Photo {
    private String google;   // Google 프로필 사진 URL (원본, 삭제 불가)
    private String custom;   // 사용자가 업로드한 커스텀 사진 URL (Firebase Storage)
  }
}
