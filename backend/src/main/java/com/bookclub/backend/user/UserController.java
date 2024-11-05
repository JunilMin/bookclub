// ./user/UserController.java
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
  public Optional<User> getUserById(@PathVariable ObjectId id) {
    return userService.getUserById(id);
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
  public User updateUser(@PathVariable ObjectId id, @RequestBody User updatedUser) {
    return userService.updateUser(id, updatedUser);
  }

  /**
   * 사용자 삭제
   */
  @DeleteMapping("/{id}")
  public void deleteUser(@PathVariable ObjectId id) {
    userService.deleteUser(id);
  }
}
