package com.bookclub.backend.openai;

import com.bookclub.backend.openai.dto.OpenAiMessage;
import com.bookclub.backend.openai.dto.OpenAiRequest;
import com.bookclub.backend.openai.dto.OpenAiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * OpenAI API와의 통신을 담당하는 클라이언트
 */
@Component
public class OpenAiClient {

    private static final Logger logger = LoggerFactory.getLogger(OpenAiClient.class);
    private static final String OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

    @Value("${openai.api.key:}")
    private String apiKey;

    @Value("${openai.model:gpt-4o-mini}")
    private String model;

    private final RestTemplate restTemplate;

    public OpenAiClient() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * API 키가 설정되어 있는지 확인
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /**
     * OpenAI Chat Completion API 호출 (default max tokens: 1000)
     */
    public OpenAiResponse getChatCompletion(String systemPrompt, String userPrompt) {
        return getChatCompletion(systemPrompt, userPrompt, 1000);
    }

    /**
     * OpenAI Chat Completion API 호출 with custom maxTokens
     */
    public OpenAiResponse getChatCompletion(String systemPrompt, String userPrompt, int maxTokens) {
        logger.info("=== OpenAI API Call Started ===");
        logger.info("Model: {}", model);
        logger.info("Max Tokens: {}", maxTokens);
        logger.info("API Key configured: {}", isConfigured());

        if (!isConfigured()) {
            logger.error("OpenAI API Key is not configured!");
            return null;
        }

        logger.info("API Key starts with: {}...", apiKey.substring(0, Math.min(20, apiKey.length())));

        // step 1. 메세지 구성
        OpenAiMessage systemMessage = new OpenAiMessage("system", systemPrompt);
        OpenAiMessage userMessage = new OpenAiMessage("user", userPrompt);
        List<OpenAiMessage> messages = List.of(systemMessage, userMessage);

        // step 2. 요청 객체 생성 with custom maxTokens
        OpenAiRequest request = new OpenAiRequest(model, messages, maxTokens);

        // step 3. HTTP 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        // step 4. HTTP 요청 엔티티 생성
        HttpEntity<OpenAiRequest> entity = new HttpEntity<>(request, headers);

        try {
            logger.info("Sending request to OpenAI API...");
            logger.info("Request URL: {}", OPENAI_API_URL);

            // step 5. API 호출
            ResponseEntity<OpenAiResponse> response = restTemplate.exchange(
                OPENAI_API_URL,
                HttpMethod.POST,
                entity,
                OpenAiResponse.class
            );

            logger.info("Response Status: {}", response.getStatusCode());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String content = response.getBody().getContent();
                logger.info("Response received successfully");
                logger.info("Content preview: {}", content != null && content.length() > 100
                    ? content.substring(0, 100) + "..."
                    : content);
                return response.getBody();
            } else {
                logger.error("Unexpected response status: {}", response.getStatusCode());
                return null;
            }

        } catch (HttpClientErrorException e) {
            logger.error("=== OpenAI API HTTP Error ===");
            logger.error("Status Code: {}", e.getStatusCode());
            logger.error("Response Body: {}", e.getResponseBodyAsString());
            logger.error("Error Message: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            logger.error("=== OpenAI API Error ===");
            logger.error("Error Type: {}", e.getClass().getName());
            logger.error("Error Message: {}", e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
}
