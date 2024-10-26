package com.bookclub.backend.auth;

import com.bookclub.backend.user.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 이 컨트롤러는 인증 관련 요청을 처리합니다.
 * 사용자 로그인 및 회원 가입을 포함한 기능을 제공하며,
 * JWT 토큰 생성을 위한 로그인과 새로운 사용자 등록을 위한 엔드포인트를 제공합니다.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  @Autowired
  private AuthService authService;

  /**
   * 제공된 자격 증명을 검증하여 사용자를 인증합니다.
   * 자격 증명이 유효한 경우 JWT 토큰을 반환합니다.
   *
   * @param authRequest 사용자 이름과 비밀번호를 포함하는 인증 요청
   * @return 인증에 성공하면 JWT 토큰을 포함하는 ResponseEntity 반환,
   *         자격 증명이 유효하지 않으면 오류 메시지를 반환
   */
  @PostMapping("/login")
  public ResponseEntity<?> authenticateUser(@RequestBody AuthRequest authRequest) {
    String token = authService.authenticateUser(authRequest.getUsername(), authRequest.getPassword());

    if (token != null) {
      return ResponseEntity.ok(new AuthResponse(token));
    } else {
      return ResponseEntity.status(401).body("Invalid username or password");
    }
  }

  /**
   * 제공된 자격 증명으로 새로운 사용자를 등록합니다.
   * 사용자 이름이 이미 존재하는 경우 오류 메시지를 반환합니다.
   *
   * @param authRequest 사용자 이름과 비밀번호를 포함하는 회원 가입 요청
   * @return 회원 가입에 성공하면 성공 메시지를 포함하는 ResponseEntity 반환,
   *         사용자 이름이 이미 존재하면 오류 메시지를 반환
   */
  @PostMapping("/register")
  public ResponseEntity<?> registerUser(@RequestBody AuthRequest authRequest) {
    try {
      User registeredUser = authService.registerUser(authRequest);
      return ResponseEntity.ok("User registered successfully: " + registeredUser.getUsername());
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(e.getMessage());
    }
  }
}
