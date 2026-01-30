package com.bookclub.backend.user;

import com.bookclub.backend.moderation.PerspectiveService;
import com.bookclub.backend.user.dto.MyMeetingsResponse;
import com.bookclub.backend.user.dto.ProfileSummaryResponse;
import com.bookclub.backend.user.dto.UserReputationDetailsResponse;
import com.bookclub.backend.user.dto.UserReputationResponse;
import com.bookclub.backend.user.dto.UserReputationSummaryResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private PerspectiveService perspectiveService;

    @Autowired
    private UserReputationService userReputationService;

    /**
     * 모든 사용자 조회
     */
    @GetMapping
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    /**
     * 총 사용자 수 조회 (공개 API)
     */
    @GetMapping("/count")
    public ResponseEntity<Long> getUserCount() {
        return ResponseEntity.ok(userService.getUserCount());
    }

    /**
     * ID로 사용자 조회
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable String id) {
        Optional<User> user = userService.getUserById(id);
        return user.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Firebase JWT를 디코드하여 UID로 사용자 정보 조회
     */
    @GetMapping("/uid")
    public ResponseEntity<?> getUserByUID(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token;
            if (cleanToken.startsWith("Bearer ")) {
                cleanToken = cleanToken.substring(7);
            }

            return userService.getUserByUID(cleanToken)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * Firebase UID로 사용자 정보 조회
     */
    @GetMapping("/uid/{uid}")
    public ResponseEntity<?> getUserByUID(@PathVariable String uid, @RequestHeader("Authorization") String token) {
        try {
            return userService.getUserByUID(uid, token)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 사용자 이름으로 사용자 조회
     */
    @GetMapping("/username/{username}")
    public Optional<User> getUserByUsername(@PathVariable String username) {
        return userService.getUserByUsername(username);
    }

    /**
     * 사용자 이름 중복 체크
     * @return true: 사용 가능, false: 이미 사용 중
     */
    @GetMapping("/check-username/{username}")
    public ResponseEntity<Boolean> checkUsernameAvailable(@PathVariable String username) {
        boolean isAvailable = userService.getUserByUsername(username).isEmpty();
        return ResponseEntity.ok(isAvailable);
    }

    /**
     * 사용자 이름 유효성 검사 (중복 체크 + 비속어 체크)
     * @return 검사 결과 (valid, duplicate, profanity, error)
     */
    @GetMapping("/validate-username/{username}")
    public ResponseEntity<Map<String, Object>> validateUsername(@PathVariable String username) {
        Map<String, Object> result = new HashMap<>();

        // 1. 중복 체크
        boolean isDuplicate = userService.getUserByUsername(username).isPresent();
        if (isDuplicate) {
            result.put("valid", false);
            result.put("reason", "duplicate");
            result.put("message", "이미 사용 중인 닉네임입니다.");
            return ResponseEntity.ok(result);
        }

        // 2. 비속어 체크 (Perspective API)
        PerspectiveService.ToxicityResult toxicityResult = perspectiveService.analyzeToxicity(username);
        if (toxicityResult.isToxic()) {
            result.put("valid", false);
            result.put("reason", "profanity");
            result.put("message", "부적절한 단어가 포함되어 있습니다.");
            result.put("score", toxicityResult.getScore());
            return ResponseEntity.ok(result);
        }

        // 3. 통과
        result.put("valid", true);
        result.put("reason", "ok");
        result.put("message", "사용 가능한 닉네임입니다.");
        return ResponseEntity.ok(result);
    }

    /**
     * 회원가입 요청 처리
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        try {
            User registeredUser = userService.registerUser(user);
            return ResponseEntity.ok("User registered successfully: " + registeredUser.getUsername());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * 사용자 정보 업데이트
     */
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable String id, @RequestBody User updatedUser) {
        User user = userService.updateUser(id, updatedUser);
        if (user != null) {
            return ResponseEntity.ok(user);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * 사용자 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * 친구 추가
     */
    @PostMapping("/{userId}/add-friend/{friendId}")
    public ResponseEntity<User> addFriend(@PathVariable String userId, @PathVariable String friendId) {
        try {
            User user = userService.addFriend(userId, friendId);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    /**
     * 사용자 평판 및 활동 데이터 조회
     * @param userId 사용자 ID
     * @param locale 언어 (ko, en)
     */
    @GetMapping("/{userId}/reputation")
    public ResponseEntity<UserReputationResponse> getUserReputation(
            @PathVariable String userId,
            @RequestParam(defaultValue = "ko") String locale) {
        try {
            UserReputationResponse response = userReputationService.getUserReputation(userId, locale);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * 현재 로그인한 사용자의 평판 및 활동 데이터 조회
     */
    @GetMapping("/me/reputation")
    public ResponseEntity<?> getMyReputation(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String locale) {
        try {
            String cleanToken = token;
            if (cleanToken.startsWith("Bearer ")) {
                cleanToken = cleanToken.substring(7);
            }

            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            UserReputationResponse response = userReputationService.getUserReputation(userOpt.get().getId(), locale);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 로그인한 사용자의 평판 요약 데이터 조회 (경량화)
     * Reputation 페이지 초기 렌더링용 - 상단 카드/핵심 지표만 포함
     */
    @GetMapping("/me/reputation/summary")
    public ResponseEntity<?> getMyReputationSummary(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String locale) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            UserReputationSummaryResponse response = userReputationService.getReputationSummary(userOpt.get().getId(), locale);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 로그인한 사용자의 평판 상세 데이터 조회
     * 탭 진입 시 로드 - 월별 출석/전체 배지/전체 활동 포함
     */
    @GetMapping("/me/reputation/details")
    public ResponseEntity<?> getMyReputationDetails(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String locale,
            @RequestParam(defaultValue = "20") int activitiesLimit,
            @RequestParam(defaultValue = "12") int months) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            UserReputationDetailsResponse response = userReputationService.getReputationDetails(
                userOpt.get().getId(), locale, activitiesLimit, months);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 로그인한 사용자의 미팅 목록 조회 (최소 필드)
     * Profile 페이지 최적화용 - 전체 /posts 조회 대체
     */
    @GetMapping("/me/meetings")
    public ResponseEntity<?> getMyMeetings(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            MyMeetingsResponse response = userService.getMyMeetings(userOpt.get().getId());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 로그인한 사용자의 프로필 요약 데이터 조회
     * Profile 페이지 상단 빠른 렌더링용
     */
    @GetMapping("/me/profile-summary")
    public ResponseEntity<?> getMyProfileSummary(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "ko") String locale) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            ProfileSummaryResponse response = userReputationService.getProfileSummary(
                userOpt.get().getId(), locale);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    // ===== 관심 도서 (Favorites) API =====

    /**
     * 현재 사용자의 좋아요한 책 목록 조회
     */
    @GetMapping("/me/favorites")
    public ResponseEntity<?> getMyFavorites(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            List<User.UserFavorite> favorites = userService.getUserFavorites(userOpt.get().getId());
            return ResponseEntity.ok(favorites);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 사용자의 AI 추천 책 목록 조회
     */
    @GetMapping("/me/ai-recommendations")
    public ResponseEntity<?> getMyAIRecommendations(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            List<User.AIRecommendation> recommendations = userService.getAIRecommendations(userOpt.get().getId());
            return ResponseEntity.ok(recommendations);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 책 좋아요 추가
     */
    @PostMapping("/me/favorites/{isbn}")
    public ResponseEntity<?> addFavorite(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            User user = userService.addFavoriteBook(userOpt.get().getId(), isbn);
            return ResponseEntity.ok(user.getFav().getUser());
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 책 좋아요 제거
     */
    @DeleteMapping("/me/favorites/{isbn}")
    public ResponseEntity<?> removeFavorite(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            User user = userService.removeFavoriteBook(userOpt.get().getId(), isbn);
            return ResponseEntity.ok(user.getFav().getUser());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 책 좋아요 토글
     */
    @PostMapping("/me/favorites/{isbn}/toggle")
    public ResponseEntity<?> toggleFavorite(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            User user = userService.toggleFavoriteBook(userOpt.get().getId(), isbn);
            boolean isNowFavorited = user.getFav().getUser().stream()
                .anyMatch(f -> f.getIsbn().equals(isbn));

            Map<String, Object> result = new HashMap<>();
            result.put("isFavorited", isNowFavorited);
            result.put("favorites", user.getFav().getUser());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 특정 책이 좋아요 되어있는지 확인
     */
    @GetMapping("/me/favorites/{isbn}/check")
    public ResponseEntity<?> checkFavorite(
            @RequestHeader("Authorization") String token,
            @PathVariable String isbn) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            boolean isFavorited = userService.isBookFavorited(userOpt.get().getId(), isbn);
            Map<String, Boolean> result = new HashMap<>();
            result.put("isFavorited", isFavorited);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 현재 사용자의 모든 관심 도서 조회 (좋아요 + AI 추천)
     */
    @GetMapping("/me/fav")
    public ResponseEntity<?> getMyFav(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            User.Fav fav = userOpt.get().getFav();
            return ResponseEntity.ok(fav);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }
}
