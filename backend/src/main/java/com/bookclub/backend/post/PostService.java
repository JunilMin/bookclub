// ./post/PostService.java

package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;

import java.util.List;
import java.util.Optional;

@Service
public class PostService {

  @Autowired
  private PostRepository postRepository;

  @Autowired
  private UserService userService;

  public List<Post> getAllPosts() {
    return postRepository.findAll();
  }

  public Optional<Post> getPostById(ObjectId id) {
    return postRepository.findById(id);
  }

  public List<Post> getPostsByCreater(String creater) {
    return postRepository.findByCreater(creater);
  }

  public Post createPost(Post post) {
    Optional<User> user = userService.getUserByUsername(post.getCreater()); // username으로 User 조회
    user.ifPresent(u -> post.setCreater(u.getUsername())); // username 값을 creater에 설정
    return postRepository.save(post);
  }

  public Post updatePost(ObjectId id, Post updatedPost) {
    Optional<Post> existingPost = postRepository.findById(id);
    if (existingPost.isPresent()) {
      Post post = existingPost.get();
      post.setCreater(updatedPost.getCreater());
      post.setDate(updatedPost.getDate());
      post.setDue(updatedPost.getDue());
      post.setCapacity(updatedPost.getCapacity());
      post.setMember(updatedPost.getMember());
      post.setLevel(updatedPost.getLevel());
      post.setBook(updatedPost.getBook());
      return postRepository.save(post);
    } else {
      return null;  // or throw an exception as discussed earlier
    }
  }

  public void deletePost(ObjectId id) {
    postRepository.deleteById(id);
  }
}
