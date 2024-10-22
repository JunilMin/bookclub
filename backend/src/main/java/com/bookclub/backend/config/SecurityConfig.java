package com.bookclub.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))  // CORS 설정
        .csrf(csrf -> csrf.disable())  // CSRF 비활성화
        .authorizeHttpRequests(authorize -> authorize
            .requestMatchers("/**").permitAll()  // /api/** 경로는 인증 없이 허용
            .anyRequest().authenticated()  // 그 외 경로는 인증 필요
        );

    return http.build();
  }

  // CORS 설정
  @Bean
  public UrlBasedCorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(List.of("http://localhost:3000"));  // 허용할 도메인
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));  // 허용할 HTTP 메서드
    configuration.setAllowedHeaders(List.of("*"));  // 허용할 헤더
    configuration.setAllowCredentials(true);  // 쿠키 허용 여부

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);  // 모든 경로에 대해 적용

    return source;
  }
}
