// ./user/UserService.java
package com.bookclub.backend.user;

import com.bookclub.backend.auth.EncryptUtils;

import org.bson.types.ObjectId;
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
   * ID로 사용자 조회
   */
  public Optional<User> getUserById(ObjectId id) {
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
      user.setUserType("regular"); // 일반 사용자로 설정
      user.setPassword(EncryptUtils.encrypt(user.getPassword())); // 비밀번호 암호화
      return userRepository.save(user);
    } catch (Exception e) {
      throw new RuntimeException("Error encrypting password: " + e.getMessage());
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  public User updateUser(ObjectId id, User updatedUser) {
    Optional<User> existingUser = userRepository.findById(id);
    if (existingUser.isPresent()) {
      User user = existingUser.get();
      user.setEmail(updatedUser.getEmail());
      user.setUsername(updatedUser.getUsername());
      user.setPassword(updatedUser.getPassword());
      user.setPosts(updatedUser.getPosts());
      user.setRating(updatedUser.getRating());
      user.setAbsent(updatedUser.getAbsent());
      user.setFriends(updatedUser.getFriends());
      user.setLate(updatedUser.getLate());
      user.setUserType(updatedUser.getUserType());
      return userRepository.save(user);
    } else {
      return null;
    }
  }

  /**
   * 사용자 삭제
   */
  public void deleteUser(ObjectId id) {
    userRepository.deleteById(id);
  }

  /**
     * 이메일로 사용자를 검색합니다.
     *
     * @param email Google 계정 이메일
     * @return 검색된 사용자 객체, 없으면 Optional.empty()
     */
    public Optional<User> findGoogleUser(String email) {
      return userRepository.findByEmail(email);
  }

  /**
   * 새로운 Google 사용자를 생성하여 저장합니다.
   *
   * @param email Google 계정 이메일
   * @param name Google 계정 이름
   * @return 새로 생성된 사용자 객체
   */
  public User createGoogleUser(String email, String name) {
      User newUser = new User();
      newUser.setEmail(email);
      newUser.setUsername(name);
      
      // 기본값 설정
      newUser.setPassword(""); // Google 계정에서는 비밀번호가 필요하지 않으므로 빈 문자열로 설정
      newUser.setPosts(new ArrayList<>()); // 빈 리스트로 초기화
      newUser.setFriends(new ArrayList<>()); // 빈 리스트로 초기화
      newUser.setRating(0); // 기본값 설정
      newUser.setAbsent(0); // 기본값 설정
      newUser.setLate(0); // 기본값 설정
      newUser.setUserType("google"); // Google 사용자로 설정
      return userRepository.save(newUser);
  }
  
  /**
   * 이메일을 기반으로 Google 사용자 계정을 삭제합니다.
   *
   * @param email 삭제할 Google 계정의 이메일
   * @return 성공적으로 삭제된 경우 true, 사용자를 찾지 못한 경우 false
   */
  public boolean deleteGoogleUser(String email) {
    Optional<User> userOptional = userRepository.findByEmail(email);
    if (userOptional.isPresent()) {
      userRepository.delete(userOptional.get());
      return true;
    }
    return false;
  }
}
