// ./user/User.java
package com.bookclub.backend.user;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
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
@Getter
@Setter
@NoArgsConstructor
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
  @JsonIgnore  // 커스텀 getter 사용
  private UserPosts posts;  // 북미팅 관련 필드 (생성/참여)
  @JsonIgnore  // 커스텀 getter 사용
  private Photo photo;  // 프로필 사진 (Google + Custom)
  private LocalDateTime createdAt;  // 회원가입 날짜

  // 신고 관련 집계 필드
  private ReportedStats reported;

  // 평가(endorsement) 관련 집계 필드
  private EndorsementStats endorsementStats;

  // 관심 도서 (좋아요 + AI 추천)
  @JsonIgnore  // 커스텀 getter 사용
  private Fav fav;

  // 프로필 설정 (관심사 탭)
  @JsonIgnore  // 커스텀 getter 사용
  private UserProfile profile;

  // 사용자 설정
  @JsonIgnore  // 커스텀 getter 사용
  private UserSetting setting;

  /**
   * posts getter - null 방지
   */
  @JsonGetter("posts")
  public UserPosts getPosts() {
    if (this.posts == null) {
      this.posts = new UserPosts(new ArrayList<>(), new ArrayList<>());
    }
    return this.posts;
  }

  /**
   * posts setter - 역직렬화용
   */
  @JsonSetter("posts")
  public void setPostsJson(UserPosts posts) {
    this.posts = posts;
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

  /**
   * fav getter - null 방지
   */
  @JsonGetter("fav")
  public Fav getFav() {
    if (this.fav == null) {
      this.fav = new Fav();
    }
    return this.fav;
  }

  /**
   * fav setter - 역직렬화용
   */
  @JsonSetter("fav")
  public void setFavJson(Fav fav) {
    this.fav = fav;
  }

  /**
   * profile getter - null 방지
   */
  @JsonGetter("profile")
  public UserProfile getProfile() {
    if (this.profile == null) {
      this.profile = new UserProfile();
    }
    return this.profile;
  }

  /**
   * profile setter - 역직렬화용
   */
  @JsonSetter("profile")
  public void setProfileJson(UserProfile profile) {
    this.profile = profile;
  }

  /**
   * setting getter - null 방지
   */
  @JsonGetter("setting")
  public UserSetting getSetting() {
    if (this.setting == null) {
      this.setting = new UserSetting();
    }
    return this.setting;
  }

  /**
   * setting setter - 역직렬화용
   */
  @JsonSetter("setting")
  public void setSettingJson(UserSetting setting) {
    this.setting = setting;
  }

  /**
   * photo getter - null 방지
   */
  @JsonGetter("photo")
  public Photo getPhoto() {
    if (this.photo == null) {
      this.photo = new Photo();
    }
    return this.photo;
  }

  /**
   * photo setter - 역직렬화용
   */
  @JsonSetter("photo")
  public void setPhotoJson(Photo photo) {
    this.photo = photo;
  }

  /**
   * 프로필 사진 URL 가져오기 (custom 우선, 없으면 google)
   * 백엔드 내부용 - JSON 응답에서 제외 (프론트엔드에서 동일 로직 사용)
   */
  @JsonIgnore
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

    public void incrementCount() {
      this.count++;
      this.lastEndorsedAt = LocalDateTime.now();
    }

    public void addPoints(int pointsToAdd) {
      this.points += pointsToAdd;
    }

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
    private String google;   // Google 프로필 사진 URL
    private String custom;   // 사용자가 업로드한 커스텀 사진 URL (Firebase Storage)
  }
}
