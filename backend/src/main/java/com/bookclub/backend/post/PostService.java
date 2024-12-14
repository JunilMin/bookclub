package com.bookclub.backend.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

// import com.bookclub.backend.googleapi.GoogleMeetService;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class PostService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserService userService;

    // @Autowired
    // private GoogleMeetService GoogleMeetService;

    /**
     * Google Meet 링크와 함께 게시물 생성
     */
    // public Post createPostWithGoogleMeet(Post post, String accessToken) {
    //     // 시작 시간 (post.getDate()를 LocalDateTime으로 가정)
    //     LocalDateTime startDateTime = post.getDate();

    //     // 종료 시간: 시작 시간으로부터 1시간 후
    //     LocalDateTime endDateTime = startDateTime.plusHours(1);
    //     // Google Meet 링크 생성
    //     try {
    //         String googleMeetLink = GoogleMeetService.createMeetEvent(
    //             accessToken,
    //             post.getBook(),
    //             Date.from(startDateTime.atZone(ZoneId.systemDefault()).toInstant()), // 시작 시간
    //             Date.from(endDateTime.atZone(ZoneId.systemDefault()).toInstant())   // 종료 시간
    //         );
    //         post.setGoogleMeetLink(googleMeetLink);
    //     } catch (Exception e) {
    //         throw new RuntimeException("Failed to create Google Meet link: " + e.getMessage());
    //     }

    //     post.setDate(LocalDateTime.now());
    //     return postRepository.save(post);
    // }

    public List<Post> getAllPosts() {
        return postRepository.findAll();
    }

    public Optional<Post> getPostById(String id) {
        return postRepository.findById(id);
    }

    public Post createPost(Post post, String accessToken) {
        Optional<User> user = userService.getUserByUsername(post.getCreater());
        user.ifPresent(u -> post.setCreater(u.getUsername()));
        // createPostWithGoogleMeet(post, accessToken);
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
            // post.setGoogleMeetLink(updatedPost.getGoogleMeetLink());
            return postRepository.save(post);
        } else {
            return null;
        }
    }

    public void deletePost(String id) {
        postRepository.deleteById(id);
    }
}
