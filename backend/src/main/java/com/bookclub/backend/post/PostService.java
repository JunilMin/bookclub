package com.bookclub.backend.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.bookclub.backend.googleapi.GoogleCalendarService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class PostService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private GoogleCalendarService googleCalendarService;

    /**
     * Google Meet 링크와 함께 게시물 생성
     */
    public Post createPostWithGoogleMeet(Post post, String accessToken) {
        // Google Meet 링크 생성
        try {
            String googleMeetLink = googleCalendarService.createMeetEvent(
                accessToken,
                post.getBook(),
                new Date(), // 현재 시간
                new Date(System.currentTimeMillis() + 3600000) // 1시간 후
            );
            post.setGoogleMeetLink(googleMeetLink);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create Google Meet link: " + e.getMessage());
        }

        post.setDate(LocalDateTime.now());
        return postRepository.save(post);
    }

    public List<Post> getAllPosts() {
        return postRepository.findAll();
    }

    public Optional<Post> getPostById(String id) {
        return postRepository.findById(id);
    }

    public Post createPost(Post post) {
        Optional<User> user = userService.getUserByUsername(post.getCreater());
        user.ifPresent(u -> post.setCreater(u.getUsername()));
        return postRepository.save(post);
    }

    public Post updatePost(String id, Post updatedPost) {
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
            return null;
        }
    }

    public void deletePost(String id) {
        postRepository.deleteById(id);
    }
}
