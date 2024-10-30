// File: ./auth/JwtUtils.java

package com.bookclub.backend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * JWT 토큰을 생성, 파싱, 검증하는 유틸리티 클래스입니다.
 * 이 클래스는 사용자 인증을 위해 JWT 토큰을 생성하고,
 * 토큰에서 사용자 정보를 추출하며, 토큰의 유효성을 검증하는 기능을 제공합니다.
 */
@Component  // JwtUtils를 Spring Bean으로 등록
public class JwtUtils {

  private final SecretKey jwtSecret = Keys.secretKeyFor(SignatureAlgorithm.HS512);
  private final long jwtExpirationMs = 86400000; // 1일(밀리초)

  /**
   * 주어진 사용자 이름을 사용하여 JWT 토큰을 생성합니다.
   *
   * @param username JWT 토큰에 포함할 사용자 이름
   * @return 생성된 JWT 토큰
   */
  public String generateJwtToken(String username) {
    return Jwts.builder()
        .setSubject(username)
        .setIssuedAt(new Date())
        .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
        .signWith(jwtSecret, SignatureAlgorithm.HS512)
        .compact();
  }

  /**
   * JWT 토큰에서 사용자 이름을 추출합니다.
   *
   * @param token 사용자 이름을 추출할 JWT 토큰
   * @return 토큰에서 추출된 사용자 이름
   */
  public String getUsernameFromJwtToken(String token) {
    Claims claims = Jwts.parserBuilder()
        .setSigningKey(jwtSecret)
        .build()
        .parseClaimsJws(token)
        .getBody();
    return claims.getSubject();
  }

  /**
   * 주어진 JWT 토큰의 유효성을 검증합니다.
   *
   * @param token 검증할 JWT 토큰
   * @return 토큰이 유효하면 true, 유효하지 않으면 false
   */
  public boolean validateJwtToken(String token) {
    try {
      Jwts.parserBuilder().setSigningKey(jwtSecret).build().parseClaimsJws(token);
      return true;
    } catch (Exception e) {
      System.out.println("Invalid JWT token: " + e.getMessage());
      return false;
    }
  }
}
