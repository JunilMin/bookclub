package com.bookclub.backend.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 인증 관련 컨트롤러
 * Firebase 인증을 사용하므로 대부분의 인증 로직은 클라이언트에서 처리됨
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /**
     * 로그인 시 Firebase 토큰을 httpOnly 쿠키에 저장
     */
    @PostMapping("/set-token")
    public ResponseEntity<?> setToken(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String token = request.get("token");
        String googleAccessToken = request.get("googleAccessToken");

        if (token == null || token.isEmpty()) {
            return ResponseEntity.badRequest().body("토큰이 필요합니다.");
        }

        // Firebase 토큰 httpOnly 쿠키 생성
        Cookie firebaseCookie = new Cookie("firebase_token", token);
        firebaseCookie.setHttpOnly(true);
        firebaseCookie.setSecure(false); // 개발환경에서는 false, 프로덕션에서는 true (HTTPS)
        firebaseCookie.setPath("/");
        firebaseCookie.setMaxAge(60 * 60); // 1시간
        response.addCookie(firebaseCookie);

        // Google Access Token httpOnly 쿠키 생성 (있는 경우에만)
        if (googleAccessToken != null && !googleAccessToken.isEmpty()) {
            Cookie googleCookie = new Cookie("google_access_token", googleAccessToken);
            googleCookie.setHttpOnly(true);
            googleCookie.setSecure(false);
            googleCookie.setPath("/");
            googleCookie.setMaxAge(60 * 60); // 1시간 (Google token 만료 시간)
            response.addCookie(googleCookie);
        }

        return ResponseEntity.ok("토큰이 쿠키에 저장되었습니다.");
    }

    /**
     * 토큰 갱신 시 쿠키 업데이트
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String token = request.get("token");
        String googleAccessToken = request.get("googleAccessToken");

        if (token == null || token.isEmpty()) {
            return ResponseEntity.badRequest().body("토큰이 필요합니다.");
        }

        // Firebase 토큰 httpOnly 쿠키 갱신
        Cookie firebaseCookie = new Cookie("firebase_token", token);
        firebaseCookie.setHttpOnly(true);
        firebaseCookie.setSecure(false);
        firebaseCookie.setPath("/");
        firebaseCookie.setMaxAge(60 * 60); // 1시간
        response.addCookie(firebaseCookie);

        // Google Access Token httpOnly 쿠키 갱신 (있는 경우에만)
        if (googleAccessToken != null && !googleAccessToken.isEmpty()) {
            Cookie googleCookie = new Cookie("google_access_token", googleAccessToken);
            googleCookie.setHttpOnly(true);
            googleCookie.setSecure(false);
            googleCookie.setPath("/");
            googleCookie.setMaxAge(60 * 60); // 1시간
            response.addCookie(googleCookie);
        }

        return ResponseEntity.ok("토큰이 갱신되었습니다.");
    }

    /**
     * 로그아웃 엔드포인트
     * Firebase 인증은 클라이언트에서 처리되므로 서버는 쿠키 삭제만 수행
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        // Firebase 토큰 쿠키 삭제
        Cookie firebaseCookie = new Cookie("firebase_token", null);
        firebaseCookie.setHttpOnly(true);
        firebaseCookie.setSecure(false);
        firebaseCookie.setPath("/");
        firebaseCookie.setMaxAge(0); // 즉시 만료
        response.addCookie(firebaseCookie);

        // Google Access Token 쿠키 삭제
        Cookie googleCookie = new Cookie("google_access_token", null);
        googleCookie.setHttpOnly(true);
        googleCookie.setSecure(false);
        googleCookie.setPath("/");
        googleCookie.setMaxAge(0); // 즉시 만료
        response.addCookie(googleCookie);

        return ResponseEntity.ok("로그아웃이 완료되었습니다.");
    }
}
