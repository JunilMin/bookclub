// backend/src/main/java/com/bookclub/backend/session/SessionService.java
package com.bookclub.backend.session;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.dto.GetSessionResponse;
import com.bookclub.backend.session.dto.JoinSessionResponse;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class SessionService {

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * 세션 참가 (없으면 생성, 있으면 재사용)
     * 권한 검증: post.member에 현재 유저의 ID가 포함되어 있거나 creater여야 함
     */
    public JoinSessionResponse joinSession(String postId, String token) throws Exception {
        // 1. Firebase 토큰에서 UID 추출
        String uid = extractUidFromToken(token);
        if (uid == null) {
            throw new UnauthorizedException("Invalid or expired token");
        }

        // 2. UID로 사용자 조회
        Optional<User> userOpt = userRepository.findByUid(uid);
        if (userOpt.isEmpty()) {
            throw new UnauthorizedException("User not found");
        }
        User user = userOpt.get();

        // 3. Post 조회
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) {
            throw new NotFoundException("Post not found");
        }
        Post post = postOpt.get();

        // 4. 권한 검증: member에 userId가 포함되어 있거나 creater여야 함
        boolean isMember = post.getMemberIds() != null && post.getMemberIds().contains(user.getId());
        boolean isCreator = post.getCreaterId() != null && post.getCreaterId().equals(user.getId());

        if (!isMember && !isCreator) {
            throw new ForbiddenException("You are not a participant of this meeting");
        }

        // 4.5. 종료된 미팅인지 확인
        if (post.isEnded()) {
            throw new MeetingEndedException("This meeting has ended");
        }

        // 5. 기존 세션 찾기 또는 새로 생성
        Optional<Session> existingSession = sessionRepository.findByPostId(postId);
        Session session;

        if (existingSession.isPresent()) {
            session = existingSession.get();
        } else {
            session = new Session(postId);
            session = sessionRepository.save(session);
        }

        // 6. 응답 생성
        return new JoinSessionResponse(
            session.getId(),
            post.getMeetLink()
        );
    }

    /**
     * 세션 조회 (권한 검증 포함)
     */
    public GetSessionResponse getSession(String sessionId, String token) throws Exception {
        // 1. Firebase 토큰에서 UID 추출
        String uid = extractUidFromToken(token);
        if (uid == null) {
            throw new UnauthorizedException("Invalid or expired token");
        }

        // 2. UID로 사용자 조회
        Optional<User> userOpt = userRepository.findByUid(uid);
        if (userOpt.isEmpty()) {
            throw new UnauthorizedException("User not found");
        }
        User user = userOpt.get();

        // 3. Session 조회
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            throw new NotFoundException("Session not found");
        }
        Session session = sessionOpt.get();

        // 4. Post 조회
        Optional<Post> postOpt = postRepository.findById(session.getPostId());
        if (postOpt.isEmpty()) {
            throw new NotFoundException("Post not found");
        }
        Post post = postOpt.get();

        // 5. 권한 검증
        boolean isMember = post.getMemberIds() != null && post.getMemberIds().contains(user.getId());
        boolean isCreator = post.getCreaterId() != null && post.getCreaterId().equals(user.getId());

        if (!isMember && !isCreator) {
            throw new ForbiddenException("You are not a participant of this meeting");
        }

        // 6. 응답 생성
        GetSessionResponse.PostInfo postInfo = new GetSessionResponse.PostInfo(
            post.getId(),
            post.getBook(),
            post.getIsbn(),
            post.getDue(),
            post.getLevel(),
            post.getCapacity(),
            post.getMemberIds() != null ? post.getMemberIds().size() : 0,
            post.getCreaterId()
        );

        // End 상태 추가
        if (post.getEnd() != null) {
            GetSessionResponse.EndInfo endInfo = new GetSessionResponse.EndInfo(
                post.getEnd().isEnded(),
                post.getEnd().getEndedAt(),
                post.getEnd().getEndedBy()
            );
            postInfo.setEnd(endInfo);
        }

        // BlockedIds 추가
        postInfo.setBlockedIds(post.getBlockedIds());

        return new GetSessionResponse(
            session.getId(),
            post.getMeetLink(),
            postInfo
        );
    }

    /**
     * Firebase 토큰에서 UID 추출
     */
    private String extractUidFromToken(String token) {
        try {
            // "Bearer " 접두사 제거
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            return decodedToken.getUid();
        } catch (FirebaseAuthException e) {
            return null;
        }
    }

    // Custom Exceptions
    public static class UnauthorizedException extends Exception {
        public UnauthorizedException(String message) {
            super(message);
        }
    }

    public static class ForbiddenException extends Exception {
        public ForbiddenException(String message) {
            super(message);
        }
    }

    public static class NotFoundException extends Exception {
        public NotFoundException(String message) {
            super(message);
        }
    }

    public static class MeetingEndedException extends Exception {
        public MeetingEndedException(String message) {
            super(message);
        }
    }
}
