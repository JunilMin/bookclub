// ./user/User.java
package com.bookclub.backend.user;
import com.bookclub.backend.post.Post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
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
  private List<Post> posts;
  private int rating;
  private int absent;
  private List<String> friends;
  private int late;
  private int kicked;  // 강퇴 당한 횟수
  private List<String> createdBookMeetings;      // 내가 생성한 북미팅 ID 리스트
  private List<String> participatedBookMeetings; // 참여한 북미팅 ID 리스트 (지난/현재 모두)
  private String photoUrl;                        // Google 프로필 사진 URL

  // 신고 관련 집계 필드
  private ReportedStats reported;

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
}
