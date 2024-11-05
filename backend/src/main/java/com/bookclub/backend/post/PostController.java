// File: ./post/PostController.java
package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "http://localhost:5173") //필요 시, 프론트 구현 후 주석 해제
public class PostController {

  @Autowired
  private PostService postService;

  @GetMapping
  public List<Post> getAllPosts() {
    return postService.getAllPosts();
  }

  @GetMapping("/{id}")
  public ResponseEntity<Post> getPostById(@PathVariable ObjectId id) {
    return postService.getPostById(id)
            .map(post -> ResponseEntity.ok(post))
            .orElse(ResponseEntity.notFound().build());
  }

  @GetMapping("/creater/{createrId}")
  public List<Post> getPostsByCreater(@PathVariable ObjectId createrId) {
    return postService.getPostsByCreater(createrId);
  }

  @PostMapping
  public ResponseEntity<Post> createPost(@RequestBody Post post) {
    Post createdPost = postService.createPost(post);
    return ResponseEntity.ok(createdPost);
  }

  @PutMapping("/{id}")
  public ResponseEntity<Post> updatePost(@PathVariable ObjectId id, @RequestBody Post updatedPost) {
    Post updated = postService.updatePost(id, updatedPost);
    if (updated != null) {
      return ResponseEntity.ok(updated);
    } else {
      return ResponseEntity.notFound().build();
    }
  }

  @DeleteMapping("/{id}")
  public void deletePost(@PathVariable String id) {
    ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
    postService.deletePost(objectId);
  }
}
