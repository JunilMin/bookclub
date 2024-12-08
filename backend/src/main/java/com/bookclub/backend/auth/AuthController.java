// ./auth/AuthController.java

package com.bookclub.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 이 컨트롤러는 인증 관련 요청을 처리합니다.
 * 사용자 로그인 기능을 제공하며,
 * JWT 토큰 생성을 위한 로그인 엔드포인트를 제공합니다.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
  @Autowired
  private AuthService authService;

  /**
   * 일반 사용자 로그인을 처리합니다. 자격 증명이 유효한 경우 JWT 토큰을 반환합니다.
   *
   * @param authRequest 사용자 이름과 비밀번호를 포함하는 인증 요청
   * @return JWT 토큰을 포함한 응답 또는 오류 메시지
   */
  // @PostMapping("/login")
  // public ResponseEntity<?> authenticateUser(@RequestBody AuthRequest authRequest, HttpServletResponse response) {
  //   AuthResponse accessToken = authService.authenticateUser(authRequest.getUsername(), authRequest.getPassword(), response);

  //   if (accessToken != null) {
  //     return ResponseEntity.ok(accessToken);
  //   } else {
  //     return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
  //   }
  // }
  
  // @PostMapping("/refresh-token")
  // public ResponseEntity<?> refreshAccessToken(@CookieValue(value = "refreshToken", required = false) String refreshToken, HttpServletResponse response) {
  //   if (refreshToken == null) {
  //     return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Refresh token is missing");
  //   }

  //   AuthResponse newAccessToken = authService.refreshAccessToken(refreshToken, response);

  //   if (newAccessToken != null) {
  //     return ResponseEntity.ok(newAccessToken);
  //   } else {
  //     return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid or expired refresh token");
  //   }
  // }
  
  /**
 * Google 로그인을 처리합니다. 사용자가 없으면 새로 생성하고, JWT 토큰을 반환합니다.
 * 이 메서드는 Google 사용자 인증 정보를 받고, 액세스 및 리프레시 토큰을 생성하여 반환합니다.
 *
 * @param googleAuthRequest Google 로그인 요청으로 전달된 이메일 및 이름 정보
 * @param response HTTP 응답 객체로 리프레시 토큰을 쿠키로 설정하기 위해 사용
 * @return JWT 액세스 토큰을 포함한 인증 응답
 */
// @PostMapping("/google-login")
// public ResponseEntity<?> googleAuthenticateUser(@RequestBody GoogleAuthRequest googleAuthRequest, HttpServletResponse response) {
//     AuthResponse authResponse = authService.authenticateOrCreateGoogleUser(
//         googleAuthRequest.getEmail(),
//         googleAuthRequest.getName(),
//         response
//     );
//     return ResponseEntity.ok(authResponse);
// }
  
  // @GetMapping("/verify-email")
  // public ResponseEntity<String> verifyEmail(@RequestParam("token") String token, @RequestParam("email") String email) {
  //   boolean isVerified = authService.verifyEmail(token, email);
  //   if (isVerified) {
  //     return ResponseEntity.ok("이메일 인증이 완료되었습니다.");
  //   } else {
  //     return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("유효하지 않은 토큰입니다.");
  //   }
  // }
  /**
   * 로그아웃 기능을 처리하여 사용자 세션을 종료하고, 리프레시 토큰을 삭제합니다.
   *
   * @param request HTTP 요청 객체로 쿠키를 삭제하기 위해 사용
   * @param response HTTP 응답 객체로 리프레시 토큰 쿠키를 삭제하기 위해 사용
   * @return 로그아웃 성공 메시지 응답
   */
  @PostMapping("/logout")
  public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
    authService.logout(request, response);
    return ResponseEntity.ok("로그아웃이 완료되었습니다.");
  }
}
