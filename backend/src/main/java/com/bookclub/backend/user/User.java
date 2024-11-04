// ./user/User.java
package com.bookclub.backend.user;
import com.bookclub.backend.post.Post;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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
  private String username;
  private String password;
  private List<Post> posts;
  private int rating;
  private int absent;
  private List<String> friends;
  private int late;
}
