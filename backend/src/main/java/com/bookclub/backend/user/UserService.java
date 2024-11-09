// ./user/UserService.java
package com.bookclub.backend.user;

import com.bookclub.backend.auth.EmailService;
import com.bookclub.backend.auth.EncryptUtils;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

  @Autowired
  private UserRepository userRepository;

  @Autowired
  EmailService emailService;

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
    if (userRepository.findByEmail(user.getEmail()).isPresent()) {
      throw new RuntimeException("이미 존재하는 이메일입니다.");
    }
    try {
      user.setFriends(new ArrayList<>()); 
      user.setPosts(new ArrayList<>());
      user.setPassword(EncryptUtils.encrypt(user.getPassword()));
      user.setVerificationToken(generateVerificationToken()); // 인증 토큰 생성
      user.setEmailVerified(false); // 이메일 인증 미완료 상태로 설정
      user = userRepository.save(user);

      // 회원가입 대상자에게 이메일 인증 발송
      emailService.sendVerificationEmail(user.getEmail(), user.getVerificationToken());

      return user;
    } catch (Exception e) {
      throw new RuntimeException("회원가입 중 오류 발생: " + e.getMessage());
    }
  }

  private String generateVerificationToken() {
    return UUID.randomUUID().toString();
  }

  /**
   * 이메일 인증 토큰을 재전송합니다.
   * 이메일이 이미 인증된 경우 예외를 발생시키며,
   * 인증되지 않은 경우 새로운 인증 토큰을 생성하고 이메일로 전송합니다.
   *
   * @param email 인증 토큰을 재전송할 사용자의 이메일 주소
   * @throws RuntimeException 이메일이 이미 인증되었거나 사용자를 찾을 수 없는 경우
   */
  public void resendVerificationToken(String email) {
    Optional<User> userOptional = userRepository.findByEmail(email);
    if (userOptional.isPresent()) {
      User user = userOptional.get();

      if (user.isEmailVerified()) {
        throw new RuntimeException("이메일이 이미 인증되었습니다.");
      }

      String newToken = generateVerificationToken();
      user.setVerificationToken(newToken);
      userRepository.save(user);

      emailService.sendVerificationEmail(user.getEmail(), newToken);
    } else {
      throw new RuntimeException("사용자를 찾을 수 없습니다.");
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

  // /**
  //  * 사용자 이메일로 사용자의 인증 토큰을 찾습니다.
  //  *
  //  * @param email 사용자 이메일
  //  * @return String 인증 토큰
  //  */
  // public String getVerificationToken(String email) {
  //   Optional<User> userOptional = userRepository.findByEmail(email);
  //   if (userOptional.isPresent()) {
  //     return userOptional.get().getVerificationToken();
  //   }
  //   return null;
  // }

  /**
   * 사용자 이메일로 사용자의 인증 상태를 확인합니다.
   *
   * @param email 사용자 이메일
   * @return 이메일 인증 상태
   */
  public boolean checkVerificationStatus(String email) {
    Optional<User> userOptional = userRepository.findByEmail(email);
    if (userOptional.isPresent()) {
      return userOptional.get().isEmailVerified();
    }
    return false;
  }
}


  

