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
  private String photoUrl;  // Google 프로필 사진 URL

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

  /**
   * fav getter - null 방지
   */
  public Fav getFav() {
    if (this.fav == null) {
      this.fav = new Fav();
    }
    return this.fav;
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
}
