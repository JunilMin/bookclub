package com.bookclub.backend.user;

import com.bookclub.backend.moderation.PerspectiveService;
import org.bson.types.ObjectId;
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

    /**
     * 모든 사용자 조회
     */
    @GetMapping
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    /**
     * ID로 사용자 조회
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable String id) {
        try {
            ObjectId objectId = new ObjectId(id);
            Optional<User> user = userService.getUserById(objectId);
            return user.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
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
        try {
            ObjectId objectId = new ObjectId(id);
            User user = userService.updateUser(objectId, updatedUser);
            if (user != null) {
                return ResponseEntity.ok(user);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 사용자 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        try {
            ObjectId objectId = new ObjectId(id);
            userService.deleteUser(objectId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 친구 추가
     */
    @PostMapping("/{userId}/add-friend/{friendId}")
    public ResponseEntity<User> addFriend(@PathVariable String userId, @PathVariable String friendId) {
        try {
            ObjectId userObjectId = new ObjectId(userId);
            ObjectId friendObjectId = new ObjectId(friendId);
            User user = userService.addFriend(userObjectId, friendObjectId);
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }
}
