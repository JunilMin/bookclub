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

/**
 * Security configuration class that enables Spring Security settings
 * and configures Cross-Origin Resource Sharing (CORS) policies.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

  /**
   * Configures the security filter chain, allowing all requests without authentication,
   * and disabling CSRF protection.
   *
   * @param http the HttpSecurity configuration
   * @return the configured SecurityFilterChain
   * @throws Exception if an error occurs during configuration
   */
  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource())) // Enable CORS with custom configuration
        .csrf(csrf -> csrf.disable()) // Disable CSRF protection
        .authorizeHttpRequests(authorize -> authorize
            .requestMatchers("/**").permitAll() // Allow all requests without authentication
            .anyRequest().authenticated() // Require authentication for all other requests
        );

    return http.build();
  }

  /**
   * Defines CORS configuration settings, including allowed origins, methods,
   * headers, and credentials for cross-origin requests.
   *
   * @return the configured UrlBasedCorsConfigurationSource for handling CORS requests
   */
  @Bean
  public UrlBasedCorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(List.of("http://localhost:8081")); // Set allowed origin for CORS
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE")); // Allow specific HTTP methods
    configuration.setAllowedHeaders(List.of("*")); // Allow all headers
    configuration.setAllowCredentials(true); // Allow credentials in CORS requests

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration); // Apply CORS configuration to all paths

    return source;
  }
}
