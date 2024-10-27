package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
//@CrossOrigin(origins = "http://localhost:8081") 필요 시, 프론트 구현 후 주석 해제
public class PostController {

  @Autowired
  private PostService postService;

  @GetMapping
  public List<Post> getAllPosts() {
    return postService.getAllPosts();
  }

  @GetMapping("/{id}")
  public Optional<Post> getPostById(@PathVariable ObjectId id) {
    return postService.getPostById(id);
  }

  @GetMapping("/creater/{createrId}")
  public List<Post> getPostsByCreater(@PathVariable ObjectId createrId) {
    return postService.getPostsByCreater(createrId);
  }

  @PostMapping
  public Post createPost(@RequestBody Post post) {
    return postService.createPost(post);
  }

  @PutMapping("/{id}")
  public Post updatePost(@PathVariable ObjectId id, @RequestBody Post updatedPost) {
    return postService.updatePost(id, updatedPost);
  }

  @DeleteMapping("/{id}")
  public void deletePost(@PathVariable ObjectId id) {
    postService.deletePost(id);
  }
}
