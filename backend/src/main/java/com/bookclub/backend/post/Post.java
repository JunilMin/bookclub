// ./post/Post.java
package com.bookclub.backend.post;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.format.annotation.DateTimeFormat;

import com.fasterxml.jackson.annotation.JsonFormat;

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

  @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
  @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss")
  private LocalDateTime date;  // 생성 날짜

  @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
  @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss")
  private LocalDateTime due;

  private int capacity;  // 인원 수
  private List<ObjectId> member;  // 멤버 ObjectId 리스트
  private String level;  // 난이도
  private String book;   // 책 제목
}

