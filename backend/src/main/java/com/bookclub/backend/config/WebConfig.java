// ./config/WebConfig.java

package com.bookclub.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web configuration class that defines Cross-Origin Resource Sharing (CORS) settings
 * for API endpoints. This configuration allows the frontend application to interact
 * with the backend API hosted on a different origin.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

  /**
   * Configures CORS mappings for the API endpoints, allowing requests from specified origins,
   * methods, and headers, and enabling credentials support.
   *
   * @param registry the CORS registry to configure
   */
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/**") // Apply CORS settings to all endpoints under /api/
        .allowedOrigins("http://localhost:5173")  // Allow requests from the frontend address
        .allowedMethods("GET", "POST", "PUT", "DELETE") // Allow specific HTTP methods
        .allowedHeaders("*") // Allow all headers
        .allowCredentials(true) // Enable credentials (cookies, authorization headers) in CORS requests
        .maxAge(3600); // Cache the CORS response for 1 hour
  }
}
