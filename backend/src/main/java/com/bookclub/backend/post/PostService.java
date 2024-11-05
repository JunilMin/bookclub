// ./post/PostService.java
package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PostService {

  @Autowired
  private PostRepository postRepository;

  public List<Post> getAllPosts() {
    return postRepository.findAll();
  }

  public Optional<Post> getPostById(ObjectId id) {
    return postRepository.findById(id);
  }

  public List<Post> getPostsByCreater(ObjectId creater) {
    return postRepository.findByCreater(creater);
  }

  public Post createPost(Post post) {
    post.setId(new ObjectId());  // 생성 시 새 ObjectId 할당
    return postRepository.save(post);
  }

  public Optional<Post> updatePost(ObjectId id, Post updatedPost) {
    return postRepository.findById(id).map(post -> {
      post.setCreater(updatedPost.getCreater());
      post.setDate(updatedPost.getDate());
      post.setDue(updatedPost.getDue());
      post.setCapacity(updatedPost.getCapacity());
      post.setMember(updatedPost.getMember());
      post.setLevel(updatedPost.getLevel());
      post.setBook(updatedPost.getBook());
      return postRepository.save(post);
    });
  }

  public boolean deletePost(ObjectId id) {
    if (postRepository.existsById(id)) {
      postRepository.deleteById(id);
      return true;
    } else {
      return false;
    }
  }
}
