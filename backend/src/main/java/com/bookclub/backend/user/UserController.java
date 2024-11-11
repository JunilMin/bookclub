package com.bookclub.backend.user;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

  @Autowired
  private UserService userService;

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
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      Optional<User> user = userService.getUserById(objectId);
      return user.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
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
   * 회원가입 요청을 처리하고 새로운 사용자를 생성합니다.
   *
   * @param user 회원가입 요청에서 제공된 사용자 정보
   * @return 성공 메시지 또는 오류 메시지를 포함한 ResponseEntity 반환
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
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      User user = userService.updateUser(objectId, updatedUser);
      if (user != null) {
        return ResponseEntity.ok(user);
      } else {
        return ResponseEntity.notFound().build();
      }
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 사용자 삭제
   */
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteUser(@PathVariable String id) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      userService.deleteUser(objectId);
      return ResponseEntity.noContent().build();
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 이메일 인증 토큰을 재전송합니다.
   *
   * @param email 인증 토큰을 재전송할 이메일 주소
   * @return 성공 또는 오류 메시지를 포함한 응답
   */
  @PostMapping("/resend-verification/{email}")
  public ResponseEntity<?> resendVerificationToken(@PathVariable("email") String email) {
    try {
      userService.resendVerificationToken(email);
      return ResponseEntity.ok("새로운 인증 이메일이 발송되었습니다.");
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(e.getMessage());
    }
  }

  // Verification status check endpoint
  @GetMapping("/verify-email-check/{email}")
  public ResponseEntity<Boolean> verificationStatus(@PathVariable("email") String email) {
    if (email != null) {
      boolean isVerified = userService.checkVerificationStatus(email);
      return ResponseEntity.ok(isVerified);
    } else {
      return ResponseEntity.badRequest().body(false);
    }
  }

  /**
   * 친구 추가 요청을 처리합니다.
   * 
   * @param userId   친구를 추가할 사용자의 ID
   * @param friendId 추가할 친구의 ID
   * @return 성공적으로 추가된 사용자 정보
   */
  @PostMapping("/{userId}/add-friend/{friendId}")
  public ResponseEntity<User> addFriend(@PathVariable String userId, @PathVariable String friendId) {
    try {
      ObjectId userObjectId = new ObjectId(userId);
      ObjectId friendObjectId = new ObjectId(friendId);
      User user = userService.addFriend(userObjectId, friendObjectId);
      return ResponseEntity.ok(user);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(null); // 이미 친구이거나 다른 오류 시 예외 처리
    }
  }

  // // Email verification endpoint
  // @GetMapping("/verification-token/{email}")
  // public ResponseEntity<String> getVerificationToken(@PathVariable("email") String email) {
  //   String token = userService.getVerificationToken(email);
  //   if (token != null) {
  //     return ResponseEntity.ok(token);
  //   } else {
  //     return ResponseEntity.status(400).body("Verification token not found");
  //   }
  // }
}
