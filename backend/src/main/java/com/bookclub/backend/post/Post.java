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
  private ObjectId id;  // MongoDB의 ObjectId
  private ObjectId creater;  // 작성자 ObjectId
  private LocalDateTime date;  // 생성 날짜
  private LocalDateTime due;   // 기한 날짜
  private int capacity;  // 인원 수
  private List<ObjectId> member;  // 멤버 ObjectId 리스트
  private String level;  // 난이도
  private String book;   // 책 제목
}

