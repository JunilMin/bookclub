// ./user/UserService.java
package com.bookclub.backend.user;

import com.bookclub.backend.auth.EncryptUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
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
   * 새로운 사용자를 등록합니다.
   * 사용자 이름이 이미 존재하면 예외를 발생시킵니다.
   *
   * @param user 등록할 사용자 정보
   * @return 등록된 User 객체
   * @throws RuntimeException 사용자 이름이 이미 존재하는 경우
   */
  public User registerUser(User user) {
    if (userRepository.findByUsername(user.getUsername()).isPresent()) {
      throw new RuntimeException("이미 존재하는 사용자입니다.");
    }

    try {
      user.setPassword(EncryptUtils.encrypt(user.getPassword())); // 비밀번호 암호화
      return userRepository.save(user);
    } catch (Exception e) {
      throw new RuntimeException("Error encrypting password: " + e.getMessage());
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  public User updateUser(String id, User updatedUser) {
    Optional<User> existingUser = userRepository.findById(id);
    if (existingUser.isPresent()) {
      User user = existingUser.get();
      user.setUsername(updatedUser.getUsername());
      user.setPassword(updatedUser.getPassword());
      user.setPosts(updatedUser.getPosts());
      user.setRating(updatedUser.getRating());
      user.setAbsent(updatedUser.getAbsent());
      user.setFriends(updatedUser.getFriends());
      user.setLate(updatedUser.getLate());
      return userRepository.save(user);
    } else {
      return null;
    }
  }

  /**
   * 사용자 삭제
   */
  public void deleteUser(String id) {
    userRepository.deleteById(id);
  }
}
