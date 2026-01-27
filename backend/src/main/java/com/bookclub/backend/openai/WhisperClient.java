package com.bookclub.backend.openai;

import com.bookclub.backend.openai.dto.WhisperResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * Client for OpenAI Whisper API (Speech-to-Text)
 */
@Component
public class WhisperClient {

    private static final Logger logger = LoggerFactory.getLogger(WhisperClient.class);
    private static final String WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

    @Value("${openai.api.key:}")
    private String apiKey;

    @Value("${openai.whisper.model:whisper-1}")
    private String whisperModel;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public WhisperClient() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Check if API key is configured
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /**
     * Transcribe audio to text using OpenAI Whisper API
     *
     * @param audioData Audio file data (WebM, MP3, WAV, etc.)
     * @param filename  Original filename with extension
     * @param language  Language hint ("auto", "ko", "en"). "auto" for auto-detection
     * @return WhisperResponse containing transcription and metadata
     */
    public WhisperResponse transcribe(byte[] audioData, String filename, String language) {
        logger.info("=== Whisper API Call Started ===");
        logger.info("Audio size: {} bytes", audioData.length);
        logger.info("Filename: {}", filename);
        logger.info("Language hint: {}", language);

        if (!isConfigured()) {
            logger.error("OpenAI API Key is not configured!");
            return createMockResponse(language);
        }

        try {
            // Create multipart form data
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(apiKey);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            // Add audio file
            ByteArrayResource audioResource = new ByteArrayResource(audioData) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };
            body.add("file", audioResource);

            // Add model
            body.add("model", whisperModel);

            // Add language if specified (not "auto")
            if (language != null && !language.equalsIgnoreCase("auto")) {
                body.add("language", language);
            }

            // Request verbose JSON for segments and duration
            body.add("response_format", "verbose_json");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            logger.info("Sending request to Whisper API...");

            ResponseEntity<String> response = restTemplate.exchange(
                WHISPER_API_URL,
                HttpMethod.POST,
                requestEntity,
                String.class
            );

            logger.info("Response Status: {}", response.getStatusCode());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                WhisperResponse whisperResponse = objectMapper.readValue(
                    response.getBody(),
                    WhisperResponse.class
                );

                whisperResponse.calculateConfidence();

                logger.info("Transcription successful");
                logger.info("Language detected: {}", whisperResponse.getLanguage());
                logger.info("Duration: {} seconds", whisperResponse.getDuration());
                logger.info("Text preview: {}", truncate(whisperResponse.getText(), 100));

                return whisperResponse;
            } else {
                logger.error("Unexpected response status: {}", response.getStatusCode());
                return createMockResponse(language);
            }

        } catch (HttpClientErrorException e) {
            logger.error("=== Whisper API HTTP Error ===");
            logger.error("Status Code: {}", e.getStatusCode());
            logger.error("Response Body: {}", e.getResponseBodyAsString());
            return createMockResponse(language);
        } catch (Exception e) {
            logger.error("=== Whisper API Error ===");
            logger.error("Error Type: {}", e.getClass().getName());
            logger.error("Error Message: {}", e.getMessage());
            e.printStackTrace();
            return createMockResponse(language);
        }
    }

    /**
     * Create a mock response for testing or when API is unavailable
     */
    private WhisperResponse createMockResponse(String language) {
        logger.warn("Creating mock Whisper response");

        WhisperResponse response = new WhisperResponse();

        String detectedLanguage = (language == null || language.equalsIgnoreCase("auto")) ? "en" : language;
        response.setLanguage(detectedLanguage);

        if ("ko".equalsIgnoreCase(detectedLanguage)) {
            response.setText("[Mock 전사] 이것은 테스트 발언입니다. Whisper API 키가 설정되지 않았거나 오류가 발생했습니다.");
        } else {
            response.setText("[Mock transcription] This is a test utterance. Whisper API key is not configured or an error occurred.");
        }

        response.setDuration(10.0);
        response.setConfidence(0.5);

        return response;
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return null;
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
