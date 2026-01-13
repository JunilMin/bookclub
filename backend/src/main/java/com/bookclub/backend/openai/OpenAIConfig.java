package com.bookclub.backend.openai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

/**
 * OpenAI Configuration
 * API 키 검증 및 로깅만 수행
 * 실제 API 호출은 OpenAIService에서 RestTemplate으로 직접 수행
 */
@Configuration
public class OpenAIConfig {

    private static final Logger logger = LoggerFactory.getLogger(OpenAIConfig.class);

    @Value("${openai.api.key:}")
    private String apiKey;

    @PostConstruct
    public void init() {
        if (apiKey == null || apiKey.isEmpty()) {
            logger.warn("=== OpenAI API Key NOT configured ===");
            logger.warn("AI Summary will return mock data.");
            logger.warn("Set 'openai.api.key' in application.properties to enable real AI summaries.");
        } else {
            logger.info("=== OpenAI API Key configured ===");
            logger.info("API Key starts with: {}...", apiKey.substring(0, Math.min(15, apiKey.length())));
            logger.info("AI Summary feature is enabled.");
        }
    }
}
