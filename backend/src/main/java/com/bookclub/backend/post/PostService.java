package com.bookclub.backend.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.bookclub.backend.googleapi.GoogleCalendarService;
import com.bookclub.backend.googleapi.GoogleCalendarService.MeetEventResult;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;

import java.time.LocalDateTime;
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
     * 모든 게시물 조회
     */
    public List<Post> getAllPosts() {
        return postRepository.findAll();
    }

    /**
     * ID로 게시물 조회
     */
    public Optional<Post> getPostById(String id) {
        return postRepository.findById(id);
    }

    /**
     * 게시물 생성 (Google Meet 링크 자동 생성 포함)
     * @param post 생성할 게시물
     * @param googleAccessToken 사용자의 Google OAuth Access Token (Calendar scope 필요, 없으면 Meet 링크 생성 안 함)
     */
    public Post createPost(Post post, String googleAccessToken) {
        // 작성자 정보 설정
        Optional<User> user = userService.getUserByUsername(post.getCreater());
        user.ifPresent(u -> post.setCreater(u.getUsername()));

        // 생성 시간 설정
        if (post.getDate() == null) {
            post.setDate(LocalDateTime.now());
        }

        // Google Meet 링크 생성 시도 (사용자 토큰 없으면 서비스 계정 사용)
        if (post.getDue() != null && post.getBook() != null) {
            try {
                MeetEventResult result = googleCalendarService.createMeetEvent(
                    post.getBook(),
                    post.getDue(),
                    post.getDue().plusHours(1),
                    googleAccessToken // null이면 서비스 계정으로 fallback
                );

                if (result.isSuccess()) {
                    post.setMeetLink(result.getMeetLink());
                    post.setCalendarEventId(result.getEventId());
                    post.setMeetError(null);
                } else {
                    post.setMeetLink(null);
                    post.setCalendarEventId(null);
                    post.setMeetError(result.getError());
                }
            } catch (Exception e) {
                // Meet 링크 생성 실패해도 Post는 저장
                post.setMeetLink(null);
                post.setCalendarEventId(null);
                post.setMeetError("Failed to create Meet link: " + e.getMessage());
            }
        }

        Post savedPost = postRepository.save(post);

        // 생성자의 createdBookMeetings에 추가
        if (savedPost.getCreater() != null) {
            userService.addCreatedBookMeeting(savedPost.getCreater(), savedPost.getId());
        }

        return savedPost;
    }

    /**
     * 게시물 업데이트
     * (v2.1에서 Calendar 이벤트 동기화 추가 예정)
     */
    public Post updatePost(String id, Post updatedPost) {
        Optional<Post> existingPost = postRepository.findById(id);
        if (existingPost.isPresent()) {
            Post post = existingPost.get();

            // 기본 필드 업데이트
            if (updatedPost.getCreater() != null) {
                post.setCreater(updatedPost.getCreater());
            }
            if (updatedPost.getDate() != null) {
                post.setDate(updatedPost.getDate());
            }
            if (updatedPost.getDue() != null) {
                post.setDue(updatedPost.getDue());
            }
            if (updatedPost.getCapacity() > 0) {
                post.setCapacity(updatedPost.getCapacity());
            }
            if (updatedPost.getMember() != null) {
                post.setMember(updatedPost.getMember());
            }
            if (updatedPost.getLevel() != null) {
                post.setLevel(updatedPost.getLevel());
            }
            if (updatedPost.getBook() != null) {
                post.setBook(updatedPost.getBook());
            }

            // 새로운 필드 업데이트
            if (updatedPost.getDuration() != null) {
                post.setDuration(updatedPost.getDuration());
            }
            if (updatedPost.getDescription() != null) {
                post.setDescription(updatedPost.getDescription());
            }
            if (updatedPost.getTags() != null) {
                post.setTags(updatedPost.getTags());
            }
            if (updatedPost.getRecruit() != null) {
                post.setRecruit(updatedPost.getRecruit());
            }

            // Meet 링크는 수정하지 않음 (v2.1에서 동기화 추가)
            return postRepository.save(post);
        }
        return null;
    }

    /**
     * 게시물 삭제
     * (v2.1에서 Calendar 이벤트 삭제 추가 예정)
     */
    public void deletePost(String id) {
        // 삭제 전에 생성자의 createdBookMeetings에서 제거
        Optional<Post> post = postRepository.findById(id);
        post.ifPresent(p -> {
            if (p.getCreater() != null) {
                userService.removeCreatedBookMeeting(p.getCreater(), id);
            }
            // TODO (v2.1): Calendar 이벤트 삭제
            // if (p.getCalendarEventId() != null) {
            //     googleCalendarService.deleteEvent(p.getCalendarEventId());
            // }
        });

        postRepository.deleteById(id);
    }

    /**
     * 북미팅 참여
     */
    public Post joinBookMeeting(String postId, String username) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 이미 참여 중인지 확인
        if (post.getMember() != null && post.getMember().contains(username)) {
            throw new RuntimeException("이미 참여 중인 북미팅입니다.");
        }

        // 정원 확인
        if (post.getMember() != null && post.getMember().size() >= post.getCapacity()) {
            throw new RuntimeException("정원이 가득 찼습니다.");
        }

        // 멤버 리스트에 추가
        if (post.getMember() == null) {
            post.setMember(new java.util.ArrayList<>());
        }
        post.getMember().add(username);

        // 사용자의 participatedBookMeetings에 추가
        userService.addParticipatedBookMeeting(username, postId);

        return postRepository.save(post);
    }

    /**
     * 북미팅 참여 취소
     */
    public Post leaveBookMeeting(String postId, String username) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 참여 중인지 확인
        if (post.getMember() == null || !post.getMember().contains(username)) {
            throw new RuntimeException("참여 중이 아닌 북미팅입니다.");
        }

        // 멤버 리스트에서 제거
        post.getMember().remove(username);

        // 사용자의 participatedBookMeetings에서 제거
        userService.removeParticipatedBookMeeting(username, postId);

        return postRepository.save(post);
    }
}
