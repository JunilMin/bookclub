// backend/src/main/java/com/bookclub/backend/session/SessionService.java
package com.bookclub.backend.session;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.dto.GetSessionResponse;
import com.bookclub.backend.session.dto.JoinSessionResponse;
import com.bookclub.backend.session.dto.NoteSummaryResponse;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.repository.SessionRecordingRepository;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.bson.types.ObjectId;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class SessionService {

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRecordingRepository sessionRecordingRepository;

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
        String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : null;
        String bookIsbn = post.getBookData() != null ? post.getBookData().getIsbn() : null;
        GetSessionResponse.PostInfo postInfo = new GetSessionResponse.PostInfo(
            post.getId(),
            bookTitle,
            bookIsbn,
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
     * 사용자가 참여한 모든 세션의 AI 요약 목록 조회
     */
    public List<NoteSummaryResponse> getUserSummaries(String token) throws Exception {
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

        List<NoteSummaryResponse> summaries = new ArrayList<>();

        // 3. 사용자가 참여한 모든 Post 조회 (participatedBookMeetings + createdBookMeetings)
        List<String> participatedIds = user.getParticipatedBookMeetings();
        List<String> createdIds = user.getCreatedBookMeetings();

        // Combine both lists, avoiding duplicates
        List<String> allPostIds = new ArrayList<>();
        if (participatedIds != null) {
            allPostIds.addAll(participatedIds);
        }
        if (createdIds != null) {
            for (String id : createdIds) {
                if (!allPostIds.contains(id)) {
                    allPostIds.add(id);
                }
            }
        }

        // 4. 각 Post에 대해 세션과 요약 정보 조회
        for (String postId : allPostIds) {
            Optional<Post> postOpt = postRepository.findById(postId);
            if (postOpt.isEmpty()) continue;
            Post post = postOpt.get();

            // Find session for this post
            Optional<Session> sessionOpt = sessionRepository.findByPostId(postId);
            if (sessionOpt.isEmpty()) continue;
            Session session = sessionOpt.get();

            // Find recording for this session
            Optional<SessionRecording> recordingOpt = sessionRecordingRepository.findBySessionId(session.getId());
            if (recordingOpt.isEmpty()) continue;
            SessionRecording recording = recordingOpt.get();

            // Skip if no AI summary
            if (recording.getAiSummary() == null) continue;

            // Get host info
            String hostId = post.getCreaterId();
            String hostUsername = "Unknown";
            String hostPhotoUrl = null;
            Integer hostRating = 0;

            if (hostId != null) {
                Optional<User> hostOpt = userRepository.findById(new ObjectId(hostId));
                if (hostOpt.isPresent()) {
                    User host = hostOpt.get();
                    hostUsername = host.getUsername();
                    hostPhotoUrl = host.getPhotoUrl();
                    hostRating = host.getRating();
                }
            }

            // Build response
            NoteSummaryResponse summary = new NoteSummaryResponse();
            summary.setSessionId(session.getId());
            summary.setPostId(postId);

            // Book info
            if (post.getBookData() != null) {
                summary.setBookTitle(post.getBookData().getTitle());
                summary.setBookAuthor(post.getBookData().getAuthor());
                summary.setBookCover(post.getBookData().getCover());
                summary.setBookGenre(post.getBookData().getGenre());
                summary.setBookIsbn(post.getBookData().getIsbn());
            }

            // Meeting info
            summary.setMeetingDate(post.getDue());
            summary.setDuration(post.getDuration());
            // participantCount = unique participants (creator + members, avoiding double count)
            int memberCount = post.getMemberIds() != null ? post.getMemberIds().size() : 0;
            boolean creatorInMembers = post.getMemberIds() != null && hostId != null && post.getMemberIds().contains(hostId);
            summary.setParticipantCount(creatorInMembers ? memberCount : memberCount + 1);
            summary.setLevel(post.getLevel());

            // Host info
            summary.setHostId(hostId);
            summary.setHostUsername(hostUsername);
            summary.setHostPhotoUrl(hostPhotoUrl);
            summary.setHostRating(hostRating);

            // Summary info
            summary.setAiSummary(recording.getAiSummary());
            summary.setSessionCreatedAt(session.getCreatedAt());

            // User's relation
            summary.setHost(hostId != null && hostId.equals(user.getId()));
            summary.setFavorite(false); // TODO: Implement favorites feature

            summaries.add(summary);
        }

        // Sort by session creation date (newest first)
        summaries.sort((a, b) -> {
            if (a.getSessionCreatedAt() == null) return 1;
            if (b.getSessionCreatedAt() == null) return -1;
            return b.getSessionCreatedAt().compareTo(a.getSessionCreatedAt());
        });

        return summaries;
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
