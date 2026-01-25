package com.bookclub.backend.user;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    /**
     * 모든 사용자 조회
     */
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    /**
     * 총 사용자 수 조회
     */
    public long getUserCount() {
        return userRepository.count();
    }

    /**
     * ID로 사용자 조회
     */
    public Optional<User> getUserById(String id) {
        return userRepository.findById(id);
    }

    /**
     * 사용자 이름으로 사용자 조회
     */
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    /**
     * Firebase UID로 사용자 조회 (토큰 파라미터 포함)
     */
    public Optional<User> getUserByUID(String uid, String token) {
        return userRepository.findByUid(uid);
    }

    /**
     * Firebase JWT 토큰을 디코드하여 UID로 사용자 조회
     *
     * @param token Firebase JWT 토큰
     * @return UID를 기반으로 조회된 사용자 정보
     */
    public Optional<User> getUserByUID(String token) {
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();
            return userRepository.findByUid(uid);
        } catch (FirebaseAuthException e) {
            throw new RuntimeException("Firebase 토큰 디코딩 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 새로운 사용자를 등록합니다.
     *
     * @param user 등록할 사용자 정보
     * @return 등록된 User 객체
     */
    public User registerUser(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new RuntimeException("이미 존재하는 사용자입니다.");
        }
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        user.setUid(user.getUid());
        user.setFriends(new ArrayList<>());
        user.setPassword(""); // Firebase 인증 사용으로 비밀번호 저장 불필요
        user.setRating(0);
        user.setAbsent(0);
        user.setLate(0);
        user.setKicked(0);
        user.setPosts(new User.UserPosts(new ArrayList<>(), new ArrayList<>()));
        user.setPhotoUrl(user.getPhotoUrl()); // Google 프로필 사진 URL (null 허용)

        return userRepository.save(user);
    }

    /**
     * 친구 추가
     */
    public User addFriend(String userId, String friendId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        User friend = userRepository.findById(friendId)
            .orElseThrow(() -> new RuntimeException("친구 사용자를 찾을 수 없습니다."));

        if (user.getFriends().contains(friend.getId())) {
            throw new RuntimeException("이미 친구 목록에 있는 사용자입니다.");
        }

        user.getFriends().add(friend.getId());
        return userRepository.save(user);
    }

    /**
     * 사용자 정보 업데이트
     */
    public User updateUser(String id, User updatedUser) {
        Optional<User> existingUser = userRepository.findById(id);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            user.setEmail(updatedUser.getEmail());
            user.setUsername(updatedUser.getUsername());
            user.setRating(updatedUser.getRating());
            user.setAbsent(updatedUser.getAbsent());
            user.setFriends(updatedUser.getFriends());
            user.setLate(updatedUser.getLate());
            user.setPhotoUrl(updatedUser.getPhotoUrl());
            if (updatedUser.getPosts() != null) {
                user.setPosts(updatedUser.getPosts());
            }
            return userRepository.save(user);
        }
        return null;
    }

    /**
     * 사용자 삭제
     */
    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }

    /**
     * posts 필드 초기화 헬퍼
     */
    private void ensurePostsInitialized(User user) {
        if (user.getPosts() == null) {
            user.setPosts(new User.UserPosts(new ArrayList<>(), new ArrayList<>()));
        }
        if (user.getPosts().getCreated() == null) {
            user.getPosts().setCreated(new ArrayList<>());
        }
        if (user.getPosts().getParticipated() == null) {
            user.getPosts().setParticipated(new ArrayList<>());
        }
    }

    /**
     * 생성한 북미팅 추가
     */
    public User addCreatedBookMeeting(String username, String postId) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);

        if (!user.getPosts().getCreated().contains(postId)) {
            user.getPosts().getCreated().add(postId);
        }

        return userRepository.save(user);
    }

    /**
     * 생성한 북미팅 제거
     */
    public User removeCreatedBookMeeting(String username, String postId) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);
        user.getPosts().getCreated().remove(postId);

        return userRepository.save(user);
    }

    /**
     * 참여한 북미팅 추가
     */
    public User addParticipatedBookMeeting(String username, String postId) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);

        if (!user.getPosts().getParticipated().contains(postId)) {
            user.getPosts().getParticipated().add(postId);
        }

        return userRepository.save(user);
    }

    /**
     * 참여한 북미팅 제거
     */
    public User removeParticipatedBookMeeting(String username, String postId) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);
        user.getPosts().getParticipated().remove(postId);

        return userRepository.save(user);
    }

    // ===== userId (String) 기반 메서드들 =====

    /**
     * userId (String)로 사용자 조회
     */
    public Optional<User> getUserByIdString(String userId) {
        return userRepository.findById(userId);
    }

    /**
     * 생성한 북미팅 추가 (userId 기반)
     */
    public User addCreatedBookMeetingById(String userId, String postId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);

        if (!user.getPosts().getCreated().contains(postId)) {
            user.getPosts().getCreated().add(postId);
        }

        return userRepository.save(user);
    }

    /**
     * 생성한 북미팅 제거 (userId 기반)
     */
    public User removeCreatedBookMeetingById(String userId, String postId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);
        user.getPosts().getCreated().remove(postId);

        return userRepository.save(user);
    }

    /**
     * 참여한 북미팅 추가 (userId 기반)
     */
    public User addParticipatedBookMeetingById(String userId, String postId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);

        if (!user.getPosts().getParticipated().contains(postId)) {
            user.getPosts().getParticipated().add(postId);
        }

        return userRepository.save(user);
    }

    /**
     * 참여한 북미팅 제거 (userId 기반)
     */
    public User removeParticipatedBookMeetingById(String userId, String postId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ensurePostsInitialized(user);
        user.getPosts().getParticipated().remove(postId);

        return userRepository.save(user);
    }

    /**
     * 강퇴 횟수 증가 (userId 기반)
     */
    public User incrementKickedCount(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        user.setKicked(user.getKicked() + 1);

        return userRepository.save(user);
    }

    /**
     * 강퇴 횟수 감소 (userId 기반) - 복구 시 사용
     */
    public User decrementKickedCount(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        if (user.getKicked() > 0) {
            user.setKicked(user.getKicked() - 1);
        }

        return userRepository.save(user);
    }

    // ===== 관심 도서 (Favorites) 관련 메서드들 =====

    /**
     * 책 좋아요 추가
     */
    public User addFavoriteBook(String userId, String isbn) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        User.Fav fav = user.getFav();

        // 이미 좋아요한 책인지 확인
        boolean alreadyLiked = fav.getUser().stream()
            .anyMatch(f -> f.getIsbn().equals(isbn));

        if (alreadyLiked) {
            throw new RuntimeException("이미 좋아요한 책입니다.");
        }

        fav.getUser().add(new User.UserFavorite(isbn));
        return userRepository.save(user);
    }

    /**
     * 책 좋아요 제거
     */
    public User removeFavoriteBook(String userId, String isbn) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        User.Fav fav = user.getFav();
        fav.getUser().removeIf(f -> f.getIsbn().equals(isbn));

        return userRepository.save(user);
    }

    /**
     * 좋아요 상태 토글
     */
    public User toggleFavoriteBook(String userId, String isbn) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        User.Fav fav = user.getFav();

        boolean alreadyLiked = fav.getUser().stream()
            .anyMatch(f -> f.getIsbn().equals(isbn));

        if (alreadyLiked) {
            fav.getUser().removeIf(f -> f.getIsbn().equals(isbn));
        } else {
            fav.getUser().add(new User.UserFavorite(isbn));
        }

        return userRepository.save(user);
    }

    /**
     * 특정 책이 좋아요 되어있는지 확인
     */
    public boolean isBookFavorited(String userId, String isbn) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        return user.getFav().getUser().stream()
            .anyMatch(f -> f.getIsbn().equals(isbn));
    }

    /**
     * 사용자의 좋아요한 책 목록 조회
     */
    public List<User.UserFavorite> getUserFavorites(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        return user.getFav().getUser();
    }

    /**
     * AI 추천 책 추가
     */
    public User addAIRecommendation(String userId, String isbn, String reason) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        User.Fav fav = user.getFav();

        // 이미 추천된 책인지 확인
        boolean alreadyRecommended = fav.getAi().stream()
            .anyMatch(r -> r.getIsbn().equals(isbn));

        if (!alreadyRecommended) {
            fav.getAi().add(new User.AIRecommendation(isbn, reason));
        }

        return userRepository.save(user);
    }

    /**
     * AI 추천 책 제거
     */
    public User removeAIRecommendation(String userId, String isbn) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        User.Fav fav = user.getFav();
        fav.getAi().removeIf(r -> r.getIsbn().equals(isbn));

        return userRepository.save(user);
    }

    /**
     * 사용자의 AI 추천 책 목록 조회
     */
    public List<User.AIRecommendation> getAIRecommendations(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        return user.getFav().getAi();
    }
}
