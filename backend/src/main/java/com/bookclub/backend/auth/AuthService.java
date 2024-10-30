// ./auth/AuthService.java

package com.bookclub.backend.auth;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * 이 서비스는 인증과 회원 가입 기능을 제공합니다.
 * 자격 증명을 검증하고 JWT 토큰을 생성하여 사용자 로그인을 처리하며,
 * 자격 증명을 암호화하여 저장함으로써 사용자 등록을 처리합니다.
 */
@Service
public class AuthService {

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private JwtUtils jwtUtils;

  /**
   * 저장된 비밀번호를 복호화하여 제공된 비밀번호와 비교함으로써 사용자를 인증합니다.
   * 자격 증명이 유효하면 JWT 토큰을 생성합니다.
   *
   * @param username 로그인하려는 사용자의 사용자 이름
   * @param password 로그인 시 제공된 평문 비밀번호
   * @return 인증이 성공하면 JWT 토큰을 반환하고, 실패하면 null을 반환
   */
  public String authenticateUser(String username, String password) {
    Optional<User> userOptional = userRepository.findByUsername(username);

    if (userOptional.isPresent()) {
      User user = userOptional.get();
      try {
        String decryptedPassword = EncryptUtils.decrypt(user.getPassword());
        if (password.equals(decryptedPassword)) {
          System.out.println("Password matches! Generating token...");
          return jwtUtils.generateJwtToken(username);
        } else {
          System.out.println("Password does not match.");
        }
      } catch (Exception e) {
        System.out.println("Error decrypting password: " + e.getMessage());
      }
    } else {
      System.out.println("User not found.");
    }
    return null;
  }

  /**
   * 제공된 비밀번호를 암호화하고, 사용자 정보를 저장하여 새로운 사용자를 등록합니다.
   * 사용자 이름이 이미 존재하는 경우 예외를 발생시킵니다.
   *
   * @param authRequest 사용자 이름과 평문 비밀번호를 포함하는 회원 가입 요청
   * @return 새로 등록된 User 객체
   * @throws RuntimeException 사용자 이름이 이미 존재하거나 암호화가 실패한 경우
   */
  public User registerUser(AuthRequest authRequest) {
    if (userRepository.findByUsername(authRequest.getUsername()).isPresent()) {
      throw new RuntimeException("이미 존재하는 사용자입니다.");
    }

    try {
      String encryptedPassword = EncryptUtils.encrypt(authRequest.getPassword());
      User newUser = new User();
      newUser.setUsername(authRequest.getUsername());
      newUser.setPassword(encryptedPassword);

      return userRepository.save(newUser);
    } catch (Exception e) {
      throw new RuntimeException("Error encrypting password: " + e.getMessage());
    }
  }
}
