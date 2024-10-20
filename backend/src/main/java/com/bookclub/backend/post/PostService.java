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
