package com.bookclub.backend.post;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "http://localhost:5173")
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
    public ResponseEntity<Post> getPostById(@PathVariable String id) {
        try {
            Optional<Post> post = postService.getPostById(id);
            return post.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 게시물 생성 (Google Meet 링크 자동 생성)
     * @param post 생성할 게시물
     * google_access_token은 httpOnly 쿠키에서 읽어옴
     */
    @PostMapping
    public ResponseEntity<Post> createPost(
            @RequestBody Post post,
            HttpServletRequest request) {
        // 쿠키에서 google_access_token 읽기
        String googleAccessToken = getGoogleAccessTokenFromCookie(request);
        Post createdPost = postService.createPost(post, googleAccessToken);
        return ResponseEntity.ok(createdPost);
    }

    /**
     * 쿠키에서 google_access_token 추출
     */
    private String getGoogleAccessTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("google_access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * 게시물 업데이트
     */
    @PutMapping("/{id}")
    public ResponseEntity<Post> updatePost(@PathVariable String id, @RequestBody Post updatedPost) {
        try {
            Post updated = postService.updatePost(id, updatedPost);
            if (updated != null) {
                return ResponseEntity.ok(updated);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build(); // 유효하지 않은 형식에 대한 예외 처리
        }
    }

    /**
     * 게시물 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable String id) {
        try {
            postService.deletePost(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 북미팅 참여
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<Post> joinBookMeeting(
            @PathVariable String id,
            @RequestParam String userId) {
        try {
            Post post = postService.joinBookMeeting(id, userId);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 북미팅 참여 취소
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<Post> leaveBookMeeting(
            @PathVariable String id,
            @RequestParam String userId) {
        try {
            Post post = postService.leaveBookMeeting(id, userId);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
