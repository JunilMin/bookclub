// ./auth/AuthService.java

package com.bookclub.backend.auth;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.bookclub.backend.user.UserService;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;


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
  private UserService userService;
  @Autowired
  private JwtUtils jwtUtils;

  /**
   * 일반 사용자 인증 처리, 자격 증명이 유효하면 JWT 토큰을 생성합니다.
   *
   * @param username 로그인하려는 사용자 이름
   * @param password 로그인 시 제공된 평문 비밀번호
   * @return JWT 토큰 또는 인증 실패 시 null 반환
   */
   public AuthResponse authenticateUser(String username, String password, HttpServletResponse response) {
    Optional<User> userOptional = userRepository.findByUsername(username);

    if (userOptional.isPresent()) {
      User user = userOptional.get();
      try {
        String decryptedPassword = EncryptUtils.decrypt(user.getPassword());
        if (password.equals(decryptedPassword)) {
          String accessToken = jwtUtils.generateJwtToken(username, "access");
          String refreshToken = jwtUtils.generateJwtToken(username, "refresh");

          // 리프레시 토큰을 HttpOnly 쿠키로 설정
          Cookie refreshTokenCookie = new Cookie("refreshToken", refreshToken);
          refreshTokenCookie.setHttpOnly(true);
          refreshTokenCookie.setSecure(true);
          refreshTokenCookie.setPath("/");
          response.addCookie(refreshTokenCookie);

          return new AuthResponse(accessToken, username);
        }
      } catch (Exception e) {
        System.out.println("Error decrypting password: " + e.getMessage());
      }
    }
    return null;
  }

  public AuthResponse refreshAccessToken(String refreshToken, HttpServletResponse response) {
    if (jwtUtils.validateJwtToken(refreshToken)) {
      String username = jwtUtils.getUsernameFromJwtToken(refreshToken);
      String newAccessToken = jwtUtils.generateJwtToken(username, "access");

      // Refresh Token의 만료가 임박한 경우 새로 발급
      if (jwtUtils.isTokenExpiringSoon(refreshToken)) {
        String newRefreshToken = jwtUtils.generateJwtToken(username, "refresh");
        Cookie refreshTokenCookie = new Cookie("refreshToken", newRefreshToken);
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setSecure(true);
        refreshTokenCookie.setPath("/api/auth/refresh-token");
        response.addCookie(refreshTokenCookie);
      }

      return new AuthResponse(newAccessToken, username);
    }
    return null;
  }

  /**
   * 새 일반 사용자를 등록합니다. 이름이 이미 존재하면 예외를 발생시킵니다.
   *
   * @param authRequest 사용자 이름과 비밀번호를 포함하는 회원 가입 요청
   * @return 새로 등록된 User 객체
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

  /**
 * Google 사용자 인증 처리. 기존 사용자를 찾거나 없으면 새로 생성하고,
 * 액세스 및 리프레시 토큰을 생성하여 반환합니다. 리프레시 토큰은
 * HttpOnly 쿠키로 설정하여 클라이언트에 전달되며, 액세스 토큰은
 * AuthResponse 객체로 반환됩니다.
 *
 * @param email Google 계정 이메일
 * @param name  Google 계정 이름
 * @param response HTTP 응답 객체로 리프레시 토큰을 쿠키로 설정하기 위해 사용
 * @return 액세스 토큰을 포함한 AuthResponse 객체
 */
public AuthResponse authenticateOrCreateGoogleUser(String email, String name, HttpServletResponse response) {
  User user = userService.findGoogleUser(email)
      .orElseGet(() -> userService.createGoogleUser(email, name));
  
  // 액세스 토큰만 AuthResponse에 포함하여 반환
  String accessToken = jwtUtils.generateJwtToken(user.getUsername(), "access");

  // 구글 로그인시, username 이 겹칠 수도 있는 문제 해결해야함.
  // 리프레시 토큰을 생성하고 HttpOnly 쿠키로 설정
  String refreshToken = jwtUtils.generateJwtToken(user.getUsername(), "refresh");
  Cookie refreshTokenCookie = new Cookie("refreshToken", refreshToken);
  refreshTokenCookie.setHttpOnly(true);
  refreshTokenCookie.setSecure(true);
  refreshTokenCookie.setPath("/api/auth/refresh-token");
  response.addCookie(refreshTokenCookie);

  // 액세스 토큰만 포함한 AuthResponse 반환
  return new AuthResponse(accessToken, user.getUsername());
}

  public boolean verifyEmail(String token, String email) {
    Optional<User> userOptional = userRepository.findByEmail(email);
    if (userOptional.isPresent()) {
        User user = userOptional.get();
        if (user.getVerificationToken() != null && user.getVerificationToken().equals(token)) {
            user.setEmailVerified(true);
            user.setVerificationToken(null); // 토큰 제거
            userRepository.save(user);
            return true;
        }
    }
    return false;
  }
  /**
   * 로그아웃을 처리하여 리프레시 토큰을 삭제합니다.
   *
   * @param request HTTP 요청 객체로 쿠키를 삭제하기 위해 사용
   * @param response HTTP 응답 객체로 리프레시 토큰 쿠키를 삭제하기 위해 사용
   */
  public void logout(HttpServletRequest request, HttpServletResponse response) {
    Cookie refreshTokenCookie = new Cookie("refreshToken", null);
    refreshTokenCookie.setHttpOnly(true);
    refreshTokenCookie.setSecure(true);
    refreshTokenCookie.setPath("/api/auth/refresh-token");
    refreshTokenCookie.setMaxAge(0); // 쿠키를 삭제하도록 설정
    response.addCookie(refreshTokenCookie);
  }
}
