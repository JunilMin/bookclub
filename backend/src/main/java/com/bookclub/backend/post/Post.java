// ./post/Post.java
package com.bookclub.backend.post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
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

  // 조회 시 동적으로 채워지는 필드 (DB에 저장되지 않음)
  @Transient
  private String hostUsername;  // 호스트 닉네임
  @Transient
  private String hostPhotoUrl;  // 호스트 프로필 사진 URL
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
   * 책 표지 이미지 URL을 나타내는 내부 클래스
   */
  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class BookCover {
    private String small;   // 작은 표지 이미지 URL (128x193)
    private String medium;  // 중간 표지 이미지 URL (더 큰 사이즈)
  }

  /**
   * 책 정보를 나타내는 내부 클래스
   */
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class BookData {
    @Getter
    private String title;     // 책 제목
    @Getter
    private String isbn;      // 책 ISBN
    private Object cover;     // 책 표지 이미지 URL (String 또는 BookCover 객체, 하위 호환성)
    @Getter
    private String author;    // 책 저자
    @Getter
    private String genre;     // 책 장르/카테고리
    @Getter
    private String ln;        // 언어 코드 ("en" 또는 "ko")

    /**
     * cover를 BookCover 객체로 반환 (하위 호환성 지원)
     * 기존 String 형식이면 small, medium 모두 같은 URL로 변환
     */
    @SuppressWarnings("unchecked")
    public BookCover getCover() {
      if (cover == null) {
        return null;
      }
      if (cover instanceof String) {
        // 기존 String 형식 → BookCover 객체로 변환
        String url = (String) cover;
        return new BookCover(url, url);
      }
      if (cover instanceof BookCover) {
        return (BookCover) cover;
      }
      if (cover instanceof java.util.Map) {
        // MongoDB에서 읽어온 LinkedHashMap 형식 처리
        java.util.Map<String, Object> map = (java.util.Map<String, Object>) cover;
        String small = map.get("small") != null ? map.get("small").toString() : null;
        String medium = map.get("medium") != null ? map.get("medium").toString() : null;
        return new BookCover(small, medium);
      }
      return null;
    }
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

