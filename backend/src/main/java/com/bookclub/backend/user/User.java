// ./user/User.java
package com.bookclub.backend.user;
import com.bookclub.backend.post.Post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;

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
  // private boolean isEmailVerified; // 이메일 인증 여부
  // private String verificationToken; // 이메일 인증 토큰
}
