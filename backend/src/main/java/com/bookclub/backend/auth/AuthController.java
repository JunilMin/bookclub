package com.bookclub.backend.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

/**
 * 인증 관련 컨트롤러
 * Firebase 인증을 사용하므로 대부분의 인증 로직은 클라이언트에서 처리됨
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // application.properties에서 설정 (기본값: false)
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    // SameSite 정책 (Lax가 기본, 운영환경에서는 Strict 권장)
    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    /**
     * 보안 쿠키 생성 헬퍼 메서드
     */
    private ResponseCookie createSecureCookie(String name, String value, Duration maxAge) {
        return ResponseCookie.from(name, value != null ? value : "")
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(cookieSameSite)
            .path("/")
            .maxAge(maxAge)
            .build();
    }

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

        // Firebase 토큰 보안 쿠키 생성
        ResponseCookie firebaseCookie = createSecureCookie("firebase_token", token, Duration.ofHours(1));
        response.addHeader(HttpHeaders.SET_COOKIE, firebaseCookie.toString());

        // Google Access Token 보안 쿠키 생성 (있는 경우에만)
        if (googleAccessToken != null && !googleAccessToken.isEmpty()) {
            ResponseCookie googleCookie = createSecureCookie("google_access_token", googleAccessToken, Duration.ofHours(1));
            response.addHeader(HttpHeaders.SET_COOKIE, googleCookie.toString());
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

        // Firebase 토큰 보안 쿠키 갱신
        ResponseCookie firebaseCookie = createSecureCookie("firebase_token", token, Duration.ofHours(1));
        response.addHeader(HttpHeaders.SET_COOKIE, firebaseCookie.toString());

        // Google Access Token 보안 쿠키 갱신 (있는 경우에만)
        if (googleAccessToken != null && !googleAccessToken.isEmpty()) {
            ResponseCookie googleCookie = createSecureCookie("google_access_token", googleAccessToken, Duration.ofHours(1));
            response.addHeader(HttpHeaders.SET_COOKIE, googleCookie.toString());
        }

        return ResponseEntity.ok("토큰이 갱신되었습니다.");
    }

    /**
     * 로그아웃 엔드포인트
     * Firebase 인증은 클라이언트에서 처리되므로 서버는 쿠키 삭제만 수행
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        // Firebase 토큰 쿠키 삭제 (maxAge=0)
        ResponseCookie firebaseCookie = createSecureCookie("firebase_token", "", Duration.ZERO);
        response.addHeader(HttpHeaders.SET_COOKIE, firebaseCookie.toString());

        // Google Access Token 쿠키 삭제
        ResponseCookie googleCookie = createSecureCookie("google_access_token", "", Duration.ZERO);
        response.addHeader(HttpHeaders.SET_COOKIE, googleCookie.toString());

        return ResponseEntity.ok("로그아웃이 완료되었습니다.");
    }
}
