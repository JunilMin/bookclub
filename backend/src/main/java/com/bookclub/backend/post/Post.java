// ./post/Post.java
package com.bookclub.backend.post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "posts")
@Getter
@Setter
@NoArgsConstructor
public class Post {

  @Id
  private String id;  // MongoDB의 ObjectId
  private String createrId;  // 작성자 User ObjectId
  private LocalDateTime date;  // 생성 날짜
  private LocalDateTime due;   // 기한 날짜
  private int capacity;  // 인원 수
  private List<String> memberIds;  // 멤버 User ObjectId 리스트
  private String level;  // 난이도

  // 책 정보 (모든 책 관련 데이터는 여기에 저장)
  private BookData bookData;

  // Google Meet 관련 필드
  private String meetLink;           // Google Meet 링크
  private String calendarEventId;    // Calendar 이벤트 ID (수정/삭제용)
  private String meetError;          // Meet 생성 실패 시 에러 메시지

  // 추가 필드
  private Integer duration;          // 진행 시간 (분)
  private String description;        // 설명
  private List<String> tags;         // 태그 리스트
  private Boolean recruit = true;    // 모집 중 여부 (기본값: true)

  // 강퇴 관련 필드
  private List<String> blockedIds;   // 강퇴된 User ObjectId 리스트

  // 종료 상태 필드
  private EndStatus end;

  /**
   * 미팅 종료 상태를 나타내는 내부 클래스
   */
  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class EndStatus {
    private boolean ended = false;           // 종료 여부
    private LocalDateTime endedAt = null;    // 종료 시각
    private String endedBy = null;           // 종료한 사용자 ID
  }

  /**
   * 책 정보를 나타내는 내부 클래스
   */
  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class BookData {
    private String title;   // 책 제목
    private String isbn;    // 책 ISBN
    private String cover;   // 책 표지 이미지 URL
    private String author;  // 책 저자
    private String genre;   // 책 장르/카테고리
    private String api;     // 데이터 출처 API ("google" 또는 "naver")
  }

  /**
   * 미팅이 종료되었는지 확인
   * end.ended == true 이거나 due 시간이 지났으면 종료로 간주
   */
  public boolean isEnded() {
    if (end != null && end.isEnded()) {
      return true;
    }
    // 기존 종료 로직: due 시간이 지났으면 종료 (선택적)
    // 현재는 명시적 종료만 체크
    return false;
  }
}

