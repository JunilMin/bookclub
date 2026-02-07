package com.bookclub.backend.session.service;

import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.dto.UserNoteResponse;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.UserSessionNote;
import com.bookclub.backend.session.repository.SessionNoteRepository;
import com.bookclub.backend.session.repository.SessionRecordingRepository;
import com.bookclub.backend.session.repository.UserSessionNoteRepository;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class UserSessionNoteService {

    private static final Logger logger = LoggerFactory.getLogger(UserSessionNoteService.class);

    @Autowired
    private UserSessionNoteRepository userSessionNoteRepository;

    @Autowired
    private SessionNoteRepository sessionNoteRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRecordingRepository sessionRecordingRepository;

    /**
     * 특정 사용자의 모든 개인 노트를 미팅 컨텍스트와 함께 조회
     */
    public List<UserNoteResponse> getUserNotesWithContext(String userId) {
        List<UserNoteResponse> responses = new ArrayList<>();
        List<UserSessionNote> notes = userSessionNoteRepository.findByUserIdOrderByUpdatedAtDesc(userId);

        for (UserSessionNote note : notes) {
            try {
                UserNoteResponse response = enrichNoteWithContext(note, userId);
                if (response != null) {
                    responses.add(response);
                }
            } catch (Exception e) {
                logger.error("Failed to enrich note {} for user {}: {}", note.getId(), userId, e.getMessage());
            }
        }

        return responses;
    }

    /**
     * 단일 노트를 미팅 컨텍스트와 함께 조회
     */
    public UserNoteResponse getNoteWithContext(String noteId, String userId) throws Exception {
        Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
        if (noteOpt.isEmpty()) {
            throw new NotFoundException("Note not found");
        }

        UserSessionNote note = noteOpt.get();

        // 권한 확인
        if (!note.getUserId().equals(userId)) {
            throw new ForbiddenException("You don't have permission to view this note");
        }

        // Auto-repair: If content is null/empty, try to restore from original session note
        if (note.getContent() == null || note.getContent().trim().isEmpty()) {
            note = repairNoteContent(note);
        }

        return enrichNoteWithContext(note, userId);
    }

    /**
     * Repair note with null content by re-fetching from original session note
     */
    private UserSessionNote repairNoteContent(UserSessionNote note) {
        logger.info("Attempting to repair null content for note: {}", note.getId());

        // Try to get content from original session note
        Optional<SessionNote> baseNoteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(note.getSessionId());
        if (baseNoteOpt.isEmpty()) {
            logger.warn("Cannot repair note {}: original session note not found", note.getId());
            // Set default empty content
            note.setContent("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Notes content could not be recovered.\"}]}]}");
            return userSessionNoteRepository.save(note);
        }

        SessionNote baseNote = baseNoteOpt.get();
        String content;

        // Use block-based content if available, otherwise fall back to legacy content
        if (baseNote.isMigrated() && baseNote.getBlocks() != null && !baseNote.getBlocks().isEmpty()) {
            content = baseNote.getContentFromBlocks();
            logger.info("Repaired note {} with block-based content from session note", note.getId());
        } else if (baseNote.getContent() != null && !baseNote.getContent().trim().isEmpty()) {
            content = baseNote.getContent();
            logger.info("Repaired note {} with legacy content from session note", note.getId());
        } else {
            content = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"No content available.\"}]}]}";
            logger.warn("Repaired note {} with default content (original also empty)", note.getId());
        }

        note.setContent(content);
        note.setBaseVersion(baseNote.getVersion());
        return userSessionNoteRepository.save(note);
    }

    /**
     * UserSessionNote를 UserNoteResponse로 변환 (컨텍스트 추가)
     */
    private UserNoteResponse enrichNoteWithContext(UserSessionNote note, String userId) {
        // 세션 조회
        Optional<Session> sessionOpt = sessionRepository.findById(note.getSessionId());
        if (sessionOpt.isEmpty()) {
            logger.warn("Session not found for note: {}", note.getId());
            return null;
        }
        Session session = sessionOpt.get();

        // Post 조회
        Optional<Post> postOpt = postRepository.findById(session.getPostId());
        if (postOpt.isEmpty()) {
            logger.warn("Post not found for session: {}", note.getSessionId());
            return null;
        }
        Post post = postOpt.get();

        // Recording 조회 (AI Summary용)
        Optional<SessionRecording> recordingOpt = sessionRecordingRepository.findBySessionId(session.getId());

        // Host 정보 조회
        String hostId = post.getCreaterId();
        String hostUsername = "Unknown";
        String hostPhotoUrl = null;
        Integer hostRating = 0;

        if (hostId != null) {
            Optional<User> hostOpt = userRepository.findById(hostId);
            if (hostOpt.isPresent()) {
                User host = hostOpt.get();
                hostUsername = host.getUsername();
                hostPhotoUrl = host.getDisplayPhotoUrl();
                hostRating = host.getRating();
            }
        }

        // Response 구성
        UserNoteResponse response = new UserNoteResponse();

        // Note Info
        response.setNoteId(note.getId());
        response.setSessionId(note.getSessionId());
        response.setPostId(session.getPostId());
        response.setTitle(note.getTitle());
        response.setContent(note.getContent());
        response.setVersion(note.getVersion());
        response.setNoteCreatedAt(note.getCreatedAt());
        response.setNoteUpdatedAt(note.getUpdatedAt());

        // Book Info
        if (post.getBookData() != null) {
            response.setBookTitle(post.getBookData().getTitle());
            response.setBookAuthor(post.getBookData().getAuthor());
            response.setBookCover(post.getBookData().getCover());
            response.setBookGenre(post.getBookData().getGenre());
            response.setBookIsbn(post.getBookData().getIsbn());
        }

        // Meeting Info
        response.setMeetingDate(post.getDue());
        response.setDuration(post.getDuration());
        // participantCount = unique participants (creator + members, avoiding double count)
        int memberCount = post.getMemberIds() != null ? post.getMemberIds().size() : 0;
        boolean creatorInMembers = post.getMemberIds() != null && hostId != null && post.getMemberIds().contains(hostId);
        response.setParticipantCount(creatorInMembers ? memberCount : memberCount + 1);
        response.setLevel(post.getLevel());

        // Host Info
        response.setHostId(hostId);
        response.setHostUsername(hostUsername);
        response.setHostPhotoUrl(hostPhotoUrl);
        response.setHostRating(hostRating);

        // AI Summary (if available)
        if (recordingOpt.isPresent() && recordingOpt.get().getAiSummary() != null) {
            response.setAiSummary(recordingOpt.get().getAiSummary());
        }

        // User's relation
        response.setHost(hostId != null && hostId.equals(userId));
        response.setFavorite(false); // TODO: Implement favorites

        // Participants list (호스트 제외 - 호스트는 별도 섹션에 표시)
        List<UserNoteResponse.ParticipantInfo> participants = new ArrayList<>();

        // Add members only (exclude host)
        if (post.getMemberIds() != null) {
            for (String memberId : post.getMemberIds()) {
                // Skip if same as host (host is shown separately)
                if (memberId.equals(hostId)) continue;

                try {
                    Optional<User> memberOpt = userRepository.findById(memberId);
                    if (memberOpt.isPresent()) {
                        User member = memberOpt.get();
                        UserNoteResponse.ParticipantInfo memberInfo = new UserNoteResponse.ParticipantInfo(
                            memberId,
                            member.getUsername(),
                            member.getDisplayPhotoUrl(),
                            member.getRating(),
                            false
                        );
                        participants.add(memberInfo);
                    }
                } catch (Exception e) {
                    logger.warn("Failed to fetch member info for {}: {}", memberId, e.getMessage());
                }
            }
        }
        response.setParticipants(participants);

        return response;
    }

    /**
     * 세션 종료 시 모든 참가자에게 공용 노트를 fork
     * @param sessionId 종료된 세션 ID
     * @return fork된 개인 노트 목록
     */
    public List<UserSessionNote> forkNotesToParticipants(String sessionId) {
        List<UserSessionNote> forkedNotes = new ArrayList<>();

        // 1. 세션 조회
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            logger.warn("Session not found for forking: {}", sessionId);
            return forkedNotes;
        }
        Session session = sessionOpt.get();

        // 2. 공용 노트 조회 (findFirst로 중복 처리)
        Optional<SessionNote> noteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
        if (noteOpt.isEmpty()) {
            logger.warn("Session note not found for forking: {}", sessionId);
            return forkedNotes;
        }
        SessionNote baseNote = noteOpt.get();

        // 3. Post 조회하여 참가자 목록 확보
        Optional<Post> postOpt = postRepository.findById(session.getPostId());
        if (postOpt.isEmpty()) {
            logger.warn("Post not found for session: {}", sessionId);
            return forkedNotes;
        }
        Post post = postOpt.get();

        // 4. 모든 참가자 수집 (creator + members)
        Set<String> participantIds = new HashSet<>();
        if (post.getCreaterId() != null) {
            participantIds.add(post.getCreaterId());
        }
        if (post.getMemberIds() != null) {
            participantIds.addAll(post.getMemberIds());
        }

        // 5. 각 참가자에게 노트 fork
        String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Discussion";
        String noteTitle = bookTitle + " 토론 노트";

        for (String userId : participantIds) {
            // 이미 fork된 노트가 있으면 스킵
            if (userSessionNoteRepository.existsBySessionIdAndUserId(sessionId, userId)) {
                logger.info("User {} already has a forked note for session {}", userId, sessionId);
                continue;
            }

            try {
                UserSessionNote userNote = UserSessionNote.forkFrom(baseNote, userId, noteTitle);
                userNote = userSessionNoteRepository.save(userNote);
                forkedNotes.add(userNote);
                logger.info("Forked note {} for user {} from session {}", userNote.getId(), userId, sessionId);
            } catch (Exception e) {
                logger.error("Failed to fork note for user {}: {}", userId, e.getMessage());
            }
        }

        return forkedNotes;
    }

    /**
     * 특정 사용자의 모든 개인 노트 조회
     */
    public List<UserSessionNote> getUserNotes(String userId) {
        return userSessionNoteRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    /**
     * 특정 세션의 사용자 개인 노트 조회
     */
    public Optional<UserSessionNote> getUserNoteForSession(String sessionId, String userId) {
        return userSessionNoteRepository.findBySessionIdAndUserId(sessionId, userId);
    }

    /**
     * 개인 노트 ID로 조회
     */
    public Optional<UserSessionNote> getNoteById(String noteId) {
        return userSessionNoteRepository.findById(noteId);
    }

    /**
     * 개인 노트 내용 업데이트
     */
    public UserSessionNote updateNoteContent(String noteId, String userId, String newContent) throws Exception {
        Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
        if (noteOpt.isEmpty()) {
            throw new NotFoundException("Note not found");
        }

        UserSessionNote note = noteOpt.get();

        // 권한 확인
        if (!note.getUserId().equals(userId)) {
            throw new ForbiddenException("You don't have permission to edit this note");
        }

        note.updateContent(newContent);
        return userSessionNoteRepository.save(note);
    }

    /**
     * 개인 노트 제목 업데이트
     */
    public UserSessionNote updateNoteTitle(String noteId, String userId, String newTitle) throws Exception {
        Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
        if (noteOpt.isEmpty()) {
            throw new NotFoundException("Note not found");
        }

        UserSessionNote note = noteOpt.get();

        // 권한 확인
        if (!note.getUserId().equals(userId)) {
            throw new ForbiddenException("You don't have permission to edit this note");
        }

        note.updateTitle(newTitle);
        return userSessionNoteRepository.save(note);
    }

    /**
     * 개인 노트 삭제
     */
    public void deleteNote(String noteId, String userId) throws Exception {
        Optional<UserSessionNote> noteOpt = userSessionNoteRepository.findById(noteId);
        if (noteOpt.isEmpty()) {
            throw new NotFoundException("Note not found");
        }

        UserSessionNote note = noteOpt.get();

        // 권한 확인
        if (!note.getUserId().equals(userId)) {
            throw new ForbiddenException("You don't have permission to delete this note");
        }

        userSessionNoteRepository.delete(note);
    }

    /**
     * 수동으로 특정 사용자에게 노트 fork (세션 종료 후 뒤늦게 참가한 경우 등)
     */
    public UserSessionNote forkNoteToUser(String sessionId, String userId) throws Exception {
        // 이미 fork된 노트가 있으면 반환
        Optional<UserSessionNote> existingOpt = userSessionNoteRepository.findBySessionIdAndUserId(sessionId, userId);
        if (existingOpt.isPresent()) {
            return existingOpt.get();
        }

        // 세션 조회
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            throw new NotFoundException("Session not found");
        }
        Session session = sessionOpt.get();

        // 공용 노트 조회 (findFirst로 중복 처리)
        Optional<SessionNote> noteOpt = sessionNoteRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
        if (noteOpt.isEmpty()) {
            throw new NotFoundException("Session note not found");
        }
        SessionNote baseNote = noteOpt.get();

        // Post 조회
        Optional<Post> postOpt = postRepository.findById(session.getPostId());
        if (postOpt.isEmpty()) {
            throw new NotFoundException("Post not found");
        }
        Post post = postOpt.get();

        // 참가자인지 확인
        boolean isParticipant = userId.equals(post.getCreaterId()) ||
            (post.getMemberIds() != null && post.getMemberIds().contains(userId));
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant of this session");
        }

        // Fork 생성
        String bookTitle = post.getBookData() != null ? post.getBookData().getTitle() : "Discussion";
        String noteTitle = bookTitle + " 토론 노트";

        UserSessionNote userNote = UserSessionNote.forkFrom(baseNote, userId, noteTitle);
        return userSessionNoteRepository.save(userNote);
    }

    // Custom Exceptions
    public static class NotFoundException extends Exception {
        public NotFoundException(String message) {
            super(message);
        }
    }

    public static class ForbiddenException extends Exception {
        public ForbiddenException(String message) {
            super(message);
        }
    }
}
