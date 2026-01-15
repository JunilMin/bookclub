// ./post/Post.java
package com.bookclub.backend.post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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
  private String book;   // 책 제목
  private String isbn;   // 책 ISBN

  // Google Meet 관련 필드
  private String meetLink;           // Google Meet 링크
  private String calendarEventId;    // Calendar 이벤트 ID (수정/삭제용)
  private String meetError;          // Meet 생성 실패 시 에러 메시지

  // 추가 필드
  private Integer duration;          // 진행 시간 (분)
  private String description;        // 설명
  private List<String> tags;         // 태그 리스트
  private Boolean recruit = true;    // 모집 중 여부 (기본값: true)
}

