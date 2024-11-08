package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "http://localhost:5173") // 필요 시, 프론트 구현 후 주석 해제
public class PostController {

  @Autowired
  private PostService postService;

  /**
   * 모든 게시물 조회
   */
  @GetMapping
  public List<Post> getAllPosts() {
    return postService.getAllPosts();
  }

  /**
   * ID로 게시물 조회
   */
  @GetMapping("/{id}")
  public ResponseEntity<Post> getPostById(@PathVariable String _id) {
    try {
      String id = new String(_id); // 문자열로 받은 id를 Deep Copy
      Optional<Post> post = postService.getPostById(id);
      return post.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 게시물 생성
   */
  @PostMapping
  public ResponseEntity<Post> createPost(@RequestBody Post post) {
    Post createdPost = postService.createPost(post);
    return ResponseEntity.ok(createdPost);
  }

  /**
   * 게시물 업데이트
   */
  @PutMapping("/{id}")
  public ResponseEntity<Post> updatePost(@PathVariable String id, @RequestBody Post updatedPost) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      Post updated = postService.updatePost(objectId, updatedPost);
      if (updated != null) {
        return ResponseEntity.ok(updated);
      } else {
        return ResponseEntity.notFound().build();
      }
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 게시물 삭제
   */
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deletePost(@PathVariable String id) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      postService.deletePost(objectId);
      return ResponseEntity.noContent().build();
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }
}
