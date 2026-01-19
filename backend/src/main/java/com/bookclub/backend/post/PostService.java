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
        // createrId가 설정되어 있는지 확인 (이미 userId가 설정되어 있어야 함)
        if (post.getCreaterId() == null || post.getCreaterId().isEmpty()) {
            throw new RuntimeException("CreaterId is required");
        }

        // 생성 시간 설정
        if (post.getDate() == null) {
            post.setDate(LocalDateTime.now());
        }

        // Google Meet 링크 생성 시도 (사용자 토큰 없으면 서비스 계정 사용)
        String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : null;
        if (post.getDue() != null && bookTitle != null) {
            try {
                MeetEventResult result = googleCalendarService.createMeetEvent(
                    bookTitle,
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
        if (savedPost.getCreaterId() != null) {
            userService.addCreatedBookMeetingById(savedPost.getCreaterId(), savedPost.getId());
        }

        return savedPost;
    }

    /**
     * 게시물 업데이트 (Google Calendar 동기화 포함)
     * @param id 수정할 게시물 ID
     * @param updatedPost 수정된 게시물 데이터
     * @param googleAccessToken 사용자의 Google OAuth Access Token (Calendar 동기화용)
     */
    public Post updatePost(String id, Post updatedPost, String googleAccessToken) {
        Optional<Post> existingPost = postRepository.findById(id);
        if (existingPost.isPresent()) {
            Post post = existingPost.get();

            // 시간/제목 변경 여부 확인 (Calendar 동기화 판단용)
            boolean dueChanged = updatedPost.getDue() != null && !updatedPost.getDue().equals(post.getDue());
            String updatedBookTitle = updatedPost.getBookData() != null ? updatedPost.getBookData().getTitle() : null;
            String currentBookTitle = post.getBookData() != null ? post.getBookData().getTitle() : null;
            boolean bookChanged = updatedBookTitle != null && !updatedBookTitle.equals(currentBookTitle);
            boolean needsCalendarSync = dueChanged || bookChanged;

            // 기본 필드 업데이트
            if (updatedPost.getCreaterId() != null) {
                post.setCreaterId(updatedPost.getCreaterId());
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
            if (updatedPost.getMemberIds() != null) {
                post.setMemberIds(updatedPost.getMemberIds());
            }
            if (updatedPost.getLevel() != null) {
                post.setLevel(updatedPost.getLevel());
            }
            if (updatedPost.getBookData() != null) {
                post.setBookData(updatedPost.getBookData());
            }

            // 추가 필드 업데이트
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

            // Google Calendar 이벤트 동기화 (시간 또는 제목 변경 시)
            String bookTitleForCalendar = post.getBookData() != null ? post.getBookData().getTitle() : null;
            if (needsCalendarSync && post.getCalendarEventId() != null && googleAccessToken != null && bookTitleForCalendar != null) {
                try {
                    boolean updated = googleCalendarService.updateEvent(
                        post.getCalendarEventId(),
                        bookTitleForCalendar,
                        post.getDue(),
                        post.getDue() != null ? post.getDue().plusHours(1) : null,
                        googleAccessToken
                    );
                    if (!updated) {
                        // Calendar 업데이트 실패 시 에러 기록 (Post는 저장)
                        post.setMeetError("Failed to sync with Google Calendar");
                    } else {
                        post.setMeetError(null);
                    }
                } catch (Exception e) {
                    post.setMeetError("Calendar sync error: " + e.getMessage());
                }
            }

            return postRepository.save(post);
        }
        return null;
    }

    /**
     * 게시물 업데이트 (기존 메서드 - 하위 호환성 유지)
     */
    public Post updatePost(String id, Post updatedPost) {
        return updatePost(id, updatedPost, null);
    }

    /**
     * 게시물의 bookData만 업데이트 (기존 Post에 bookData가 없을 때 사용)
     * @param id 게시물 ID
     * @param bookData 저장할 책 정보
     */
    public Post updateBookData(String id, Post.BookData bookData) {
        Optional<Post> existingPost = postRepository.findById(id);
        if (existingPost.isPresent()) {
            Post post = existingPost.get();
            post.setBookData(bookData);
            return postRepository.save(post);
        }
        return null;
    }

    /**
     * 게시물 삭제 (Google Calendar 이벤트 삭제 포함)
     * @param id 삭제할 게시물 ID
     * @param googleAccessToken 사용자의 Google OAuth Access Token (Calendar 삭제용)
     */
    public void deletePost(String id, String googleAccessToken) {
        // 삭제 전에 생성자의 createdBookMeetings에서 제거
        Optional<Post> post = postRepository.findById(id);
        post.ifPresent(p -> {
            if (p.getCreaterId() != null) {
                userService.removeCreatedBookMeetingById(p.getCreaterId(), id);
            }

            // Google Calendar 이벤트 삭제
            if (p.getCalendarEventId() != null && googleAccessToken != null) {
                try {
                    googleCalendarService.deleteEvent(p.getCalendarEventId(), googleAccessToken);
                } catch (Exception e) {
                    // Calendar 삭제 실패해도 Post는 삭제 진행
                    System.err.println("Failed to delete calendar event: " + e.getMessage());
                }
            }
        });

        postRepository.deleteById(id);
    }

    /**
     * 게시물 삭제 (기존 메서드 - 하위 호환성 유지)
     */
    public void deletePost(String id) {
        deletePost(id, null);
    }

    /**
     * 미팅 종료 (호스트만 가능)
     * Idempotent: 이미 종료된 경우 동일한 응답 반환
     * @param postId 종료할 게시물 ID
     * @param requesterId 요청자 ID (호스트)
     * @return 종료 상태가 업데이트된 Post
     */
    public Post endPost(String postId, String requesterId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new PostNotFoundException("게시물을 찾을 수 없습니다."));

        // 권한 확인: 요청자가 방 생성자인지
        if (!post.getCreaterId().equals(requesterId)) {
            throw new UnauthorizedEndException("미팅 종료 권한이 없습니다.");
        }

        // Idempotent: 이미 종료된 경우 그대로 반환
        if (post.getEnd() != null && post.getEnd().isEnded()) {
            return post;
        }

        // 종료 상태 설정
        Post.EndStatus endStatus = new Post.EndStatus();
        endStatus.setEnded(true);
        endStatus.setEndedAt(LocalDateTime.now());
        endStatus.setEndedBy(requesterId);
        post.setEnd(endStatus);

        return postRepository.save(post);
    }

    /**
     * 북미팅 참여
     */
    public Post joinBookMeeting(String postId, String userId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 종료된 미팅인지 확인
        if (post.isEnded()) {
            throw new MeetingEndedException("이미 종료된 미팅입니다.");
        }

        // 이미 참여 중인지 확인
        if (post.getMemberIds() != null && post.getMemberIds().contains(userId)) {
            throw new RuntimeException("이미 참여 중인 북미팅입니다.");
        }

        // 정원 확인
        if (post.getMemberIds() != null && post.getMemberIds().size() >= post.getCapacity()) {
            throw new RuntimeException("정원이 가득 찼습니다.");
        }

        // 멤버 리스트에 추가
        if (post.getMemberIds() == null) {
            post.setMemberIds(new java.util.ArrayList<>());
        }
        post.getMemberIds().add(userId);

        // 사용자의 participatedBookMeetings에 추가
        userService.addParticipatedBookMeetingById(userId, postId);

        return postRepository.save(post);
    }

    // Custom Exceptions
    public static class PostNotFoundException extends RuntimeException {
        public PostNotFoundException(String message) {
            super(message);
        }
    }

    public static class UnauthorizedEndException extends RuntimeException {
        public UnauthorizedEndException(String message) {
            super(message);
        }
    }

    public static class MeetingEndedException extends RuntimeException {
        public MeetingEndedException(String message) {
            super(message);
        }
    }

    /**
     * 북미팅 참여 취소
     */
    public Post leaveBookMeeting(String postId, String userId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 참여 중인지 확인
        if (post.getMemberIds() == null || !post.getMemberIds().contains(userId)) {
            throw new RuntimeException("참여 중이 아닌 북미팅입니다.");
        }

        // 멤버 리스트에서 제거
        post.getMemberIds().remove(userId);

        // 사용자의 participatedBookMeetings에서 제거
        userService.removeParticipatedBookMeetingById(userId, postId);

        return postRepository.save(post);
    }

    /**
     * 멤버 강퇴 (방장만 가능)
     * - memberIds에서 제거
     * - blockedIds에 추가
     */
    public Post kickMember(String postId, String targetUserId, String requesterId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 권한 확인: 요청자가 방 생성자인지
        if (!post.getCreaterId().equals(requesterId)) {
            throw new RuntimeException("강퇴 권한이 없습니다.");
        }

        // 자기 자신 강퇴 방지
        if (targetUserId.equals(requesterId)) {
            throw new RuntimeException("자기 자신을 강퇴할 수 없습니다.");
        }

        // 멤버인지 확인
        if (post.getMemberIds() == null || !post.getMemberIds().contains(targetUserId)) {
            throw new RuntimeException("해당 유저는 멤버가 아닙니다.");
        }

        // memberIds에서 제거
        post.getMemberIds().remove(targetUserId);

        // blockedIds에 추가
        if (post.getBlockedIds() == null) {
            post.setBlockedIds(new java.util.ArrayList<>());
        }
        if (!post.getBlockedIds().contains(targetUserId)) {
            post.getBlockedIds().add(targetUserId);
        }

        // 사용자의 participatedBookMeetings에서 제거
        userService.removeParticipatedBookMeetingById(targetUserId, postId);

        // 사용자의 강퇴 횟수 증가
        userService.incrementKickedCount(targetUserId);

        return postRepository.save(post);
    }

    /**
     * 특정 유저에게 보이지 않는 게시물 제외하고 조회
     */
    public List<Post> getAllPostsExcludingBlocked(String userId) {
        List<Post> allPosts = postRepository.findAll();
        if (userId == null || userId.isEmpty()) {
            return allPosts;
        }
        return allPosts.stream()
            .filter(post -> post.getBlockedIds() == null || !post.getBlockedIds().contains(userId))
            .collect(java.util.stream.Collectors.toList());
    }

    /**
     * 강퇴 유저 복구 (방장만 가능)
     * - blockedIds에서 제거
     * - memberIds에 추가
     * - kicked 횟수 감소
     */
    public Post restoreMember(String postId, String targetUserId, String requesterId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        // 권한 확인: 요청자가 방 생성자인지
        if (!post.getCreaterId().equals(requesterId)) {
            throw new RuntimeException("복구 권한이 없습니다.");
        }

        // blockedIds에 있는지 확인
        if (post.getBlockedIds() == null || !post.getBlockedIds().contains(targetUserId)) {
            throw new RuntimeException("해당 유저는 강퇴 목록에 없습니다.");
        }

        // blockedIds에서 제거
        post.getBlockedIds().remove(targetUserId);

        // memberIds에 추가
        if (post.getMemberIds() == null) {
            post.setMemberIds(new java.util.ArrayList<>());
        }
        if (!post.getMemberIds().contains(targetUserId)) {
            post.getMemberIds().add(targetUserId);
        }

        // 사용자의 participatedBookMeetings에 추가
        userService.addParticipatedBookMeetingById(targetUserId, postId);

        // 사용자의 강퇴 횟수 감소
        userService.decrementKickedCount(targetUserId);

        return postRepository.save(post);
    }

    /**
     * 강퇴된 유저 목록 조회
     */
    public List<String> getBlockedUserIds(String postId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new RuntimeException("게시물을 찾을 수 없습니다."));

        return post.getBlockedIds() != null ? post.getBlockedIds() : new java.util.ArrayList<>();
    }
}
