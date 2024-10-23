package com.bookclub.backend.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
//@CrossOrigin(origins = "http://localhost:8081") 필요 시, 프론트 구현 후 주석 해제
public class UserController {

  @Autowired
  private UserService userService;

  @GetMapping
  public List<User> getAllUsers() {
    return userService.getAllUsers();
  }

  @GetMapping("/{id}")
  public Optional<User> getUserById(@PathVariable String id) {
    return userService.getUserById(id);
  }

  @GetMapping("/username/{username}")
  public Optional<User> getUserByUsername(@PathVariable String username) {
    return userService.getUserByUsername(username);
  }

  @PostMapping
  public User createUser(@RequestBody User user) {
    return userService.createUser(user);
  }

  @PutMapping("/{id}")
  public User updateUser(@PathVariable String id, @RequestBody User updatedUser) {
    return userService.updateUser(id, updatedUser);
  }

  @DeleteMapping("/{id}")
  public void deleteUser(@PathVariable String id) {
    userService.deleteUser(id);
  }
}
