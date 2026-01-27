package com.bookclub.backend.openai;

import com.bookclub.backend.openai.dto.OpenAiResponse;
import com.bookclub.backend.session.model.SessionUtterance.UtteranceSummary;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Service for refining STT raw text and generating structured summaries using LLM.
 */
@Service
@RequiredArgsConstructor
public class UtteranceRefinerService {

    private static final Logger logger = LoggerFactory.getLogger(UtteranceRefinerService.class);
    private final OpenAiClient openAiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Build system prompt for text refinement
     */
    private String buildRefineSystemPrompt(String language) {
        String languageInstruction = "ko".equalsIgnoreCase(language)
            ? "IMPORTANT: 응답은 반드시 한국어로 작성하세요."
            : "IMPORTANT: Respond in English.";

        String instructionDetail = "ko".equalsIgnoreCase(language)
            ? """
                당신은 음성 인식(STT) 결과를 정리하는 전문가입니다.

                다음 규칙을 반드시 따르세요:
                1. 축약 금지: 내용을 생략하거나 요약하지 마세요. 원문의 모든 내용을 포함하세요.
                2. 문맥 보존: 발화자의 의도와 논리 흐름을 유지하세요.
                3. 오인식 보정: STT 오류를 문맥에 맞게 수정하세요 (예: "자연어 처리" vs "자연 처리").
                4. 가독성 향상: 적절한 문장 부호와 단락 구분을 추가하세요.
                5. 불필요한 반복만 제거하고, 의미 있는 반복은 유지하세요.

                출력 형식: 정리된 텍스트만 반환하세요. 추가 설명이나 마크다운 없이.
                """
            : """
                You are an expert at refining speech-to-text (STT) transcriptions.

                Follow these rules strictly:
                1. NO ABBREVIATION: Do not summarize or omit any content. Include everything from the original.
                2. PRESERVE CONTEXT: Maintain the speaker's intent and logical flow.
                3. CORRECT ERRORS: Fix STT recognition errors based on context (e.g., "natural language processing" vs "natural language crossing").
                4. IMPROVE READABILITY: Add appropriate punctuation and paragraph breaks.
                5. Remove only unnecessary repetitions; keep meaningful ones.

                Output format: Return only the refined text. No additional explanations or markdown.
                """;

        return languageInstruction + "\n\n" + instructionDetail;
    }

    /**
     * Build system prompt for summary generation
     */
    private String buildSummarySystemPrompt(String language) {
        String languageInstruction = "ko".equalsIgnoreCase(language)
            ? "IMPORTANT: 응답은 반드시 한국어로 작성하세요."
            : "IMPORTANT: Respond in English.";

        return """
            %s

            You are an assistant that extracts structured information from discussion utterances.
            Given the refined text of a speaker's utterance, extract:

            1. keyPoints: 2-3 key points or main arguments (list of strings)
            2. issues: Any issues, problems, or arguments raised (list of strings, can be empty)
            3. topics: Main topics or keywords mentioned (list of strings, 3-5 items)

            IMPORTANT RULES:
            1. Return ONLY valid JSON, no markdown code blocks
            2. Use the exact JSON structure shown below
            3. ALL text must be in the specified language

            Required JSON structure:
            {
                "keyPoints": ["Point 1", "Point 2"],
                "issues": ["Issue 1"],
                "topics": ["Topic A", "Topic B", "Topic C"]
            }
            """.formatted(languageInstruction);
    }

    /**
     * Refine STT raw text to readable text.
     * - No abbreviation (full content preserved)
     * - Context preserved
     * - STT errors corrected
     * - Readability improved
     *
     * @param rawText   Raw STT transcription
     * @param bookTitle Book title for context
     * @param language  Language code ("ko" or "en")
     * @return Refined text
     */
    public String refineUtterance(String rawText, String bookTitle, String language) {
        logger.info("=== Utterance Refinement Started ===");
        logger.info("Language: {}", language);
        logger.info("Raw text length: {} characters", rawText != null ? rawText.length() : 0);

        if (!openAiClient.isConfigured()) {
            logger.warn("OpenAI API Key not configured - returning raw text");
            return rawText;
        }

        if (rawText == null || rawText.trim().length() < 10) {
            logger.warn("Raw text too short - returning as is");
            return rawText;
        }

        String systemPrompt = buildRefineSystemPrompt(language);
        String userPrompt = String.format(
            "Book being discussed: %s\n\nRaw STT transcription to refine:\n%s",
            bookTitle != null ? bookTitle : "Unknown",
            rawText
        );

        try {
            OpenAiResponse response = openAiClient.getChatCompletion(systemPrompt, userPrompt);

            if (response != null && response.getContent() != null) {
                String refined = response.getContent().trim();
                logger.info("Refinement successful. Refined length: {} characters", refined.length());
                return refined;
            }
        } catch (Exception e) {
            logger.error("Error during refinement: {}", e.getMessage());
        }

        logger.warn("Refinement failed - returning raw text");
        return rawText;
    }

    /**
     * Generate structured summary from refined text.
     *
     * @param refinedText Refined utterance text
     * @param language    Language code ("ko" or "en")
     * @return UtteranceSummary with keyPoints, issues, and topics
     */
    public UtteranceSummary generateSummary(String refinedText, String language) {
        logger.info("=== Utterance Summary Generation Started ===");
        logger.info("Language: {}", language);
        logger.info("Refined text length: {} characters", refinedText != null ? refinedText.length() : 0);

        if (!openAiClient.isConfigured()) {
            logger.warn("OpenAI API Key not configured - returning mock summary");
            return createMockSummary(language);
        }

        if (refinedText == null || refinedText.trim().length() < 20) {
            logger.warn("Refined text too short - returning mock summary");
            return createMockSummary(language);
        }

        String systemPrompt = buildSummarySystemPrompt(language);

        try {
            OpenAiResponse response = openAiClient.getChatCompletion(systemPrompt, refinedText);

            if (response != null && response.getContent() != null) {
                return parseSummaryFromJson(response.getContent(), language);
            }
        } catch (Exception e) {
            logger.error("Error during summary generation: {}", e.getMessage());
        }

        logger.warn("Summary generation failed - returning mock summary");
        return createMockSummary(language);
    }

    /**
     * Parse JSON response to UtteranceSummary
     */
    private UtteranceSummary parseSummaryFromJson(String json, String language) {
        try {
            // Clean up JSON
            json = json.trim();
            if (json.startsWith("```json")) {
                json = json.substring(7);
            } else if (json.startsWith("```")) {
                json = json.substring(3);
            }
            if (json.endsWith("```")) {
                json = json.substring(0, json.length() - 3);
            }
            json = json.trim();

            logger.info("Parsing summary JSON...");
            JsonNode root = objectMapper.readTree(json);

            List<String> keyPoints = extractStringList(root, "keyPoints");
            List<String> issues = extractStringList(root, "issues");
            List<String> topics = extractStringList(root, "topics");

            // Provide defaults if empty
            if (keyPoints.isEmpty()) {
                keyPoints = "ko".equalsIgnoreCase(language)
                    ? Arrays.asList("주요 논점이 언급되었습니다")
                    : Arrays.asList("Main point mentioned");
            }
            if (topics.isEmpty()) {
                topics = "ko".equalsIgnoreCase(language)
                    ? Arrays.asList("토론", "의견")
                    : Arrays.asList("Discussion", "Opinion");
            }

            logger.info("Summary parsed successfully. KeyPoints: {}, Issues: {}, Topics: {}",
                keyPoints.size(), issues.size(), topics.size());

            return new UtteranceSummary(keyPoints, issues, topics);

        } catch (Exception e) {
            logger.error("Failed to parse summary JSON: {}", e.getMessage());
            return createMockSummary(language);
        }
    }

    /**
     * Extract string list from JSON node
     */
    private List<String> extractStringList(JsonNode root, String fieldName) {
        List<String> result = new ArrayList<>();
        JsonNode node = root.path(fieldName);
        if (node.isArray()) {
            for (JsonNode item : node) {
                String text = item.asText();
                if (text != null && !text.trim().isEmpty()) {
                    result.add(text);
                }
            }
        }
        return result;
    }

    /**
     * Create mock summary when API unavailable
     */
    private UtteranceSummary createMockSummary(String language) {
        boolean isKorean = "ko".equalsIgnoreCase(language);

        List<String> keyPoints = isKorean
            ? Arrays.asList("주요 의견이 제시되었습니다", "토론 내용이 공유되었습니다")
            : Arrays.asList("Key opinion was shared", "Discussion point was made");

        List<String> issues = new ArrayList<>(); // Empty by default

        List<String> topics = isKorean
            ? Arrays.asList("토론", "의견", "관점")
            : Arrays.asList("Discussion", "Opinion", "Perspective");

        return new UtteranceSummary(keyPoints, issues, topics);
    }
}
