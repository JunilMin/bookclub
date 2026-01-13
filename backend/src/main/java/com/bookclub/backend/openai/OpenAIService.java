package com.bookclub.backend.openai;

import com.bookclub.backend.openai.dto.OpenAiResponse;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AISummary.Agreement;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OpenAIService {

    private static final Logger logger = LoggerFactory.getLogger(OpenAIService.class);
    private static final String MODEL = "gpt-4o-mini";

    private final OpenAiClient openAiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String buildSystemPrompt(String language) {
        String languageInstruction;
        if ("ko".equalsIgnoreCase(language) || "kr".equalsIgnoreCase(language)) {
            languageInstruction = "IMPORTANT: You MUST respond in Korean (한국어).";
        } else {
            languageInstruction = "IMPORTANT: You MUST respond in English.";
        }

        return """
            You are an AI assistant that summarizes book club discussions.
            Given the discussion notes, provide a summary in JSON format.

            %s

            IMPORTANT RULES:
            1. Return ONLY valid JSON, no markdown code blocks, no extra text
            2. Use the exact JSON structure shown below
            3. ALL text content must be in the specified language

            Required JSON structure:
            {
                "oneLiner": "A single sentence summary of the discussion",
                "keyPoints": ["Point 1", "Point 2", "Point 3"],
                "quotes": ["Quote 1", "Quote 2"],
                "agreements": [
                    {"point": "Something everyone agreed on", "isAgreement": true},
                    {"point": "Something debated", "isAgreement": false}
                ],
                "openQuestions": ["Question 1", "Question 2"]
            }
            """.formatted(languageInstruction);
    }

    /**
     * 노트 내용을 기반으로 AI 요약 생성
     * @param bookTitle 책 제목
     * @param noteContent 노트 내용
     * @param language 요약 언어 ("ko" or "en")
     */
    public AISummary generateSummary(String bookTitle, String noteContent, String language) {
        logger.info("=== AI Summary Generation Started ===");
        logger.info("Book Title: {}", bookTitle);
        logger.info("Language: {}", language);
        logger.info("Note Content Length: {} characters", noteContent != null ? noteContent.length() : 0);

        // API 키 확인
        if (!openAiClient.isConfigured()) {
            logger.warn("OpenAI API Key is NOT configured - returning mock summary");
            return createMockSummary(bookTitle, language);
        }

        // 노트 내용이 너무 짧으면 mock 반환
        if (noteContent == null || noteContent.trim().length() < 50) {
            logger.warn("Note content is too short ({} chars) - returning mock summary",
                noteContent != null ? noteContent.length() : 0);
            return createMockSummary(bookTitle, language);
        }

        // 노트 내용 미리보기
        logger.info("Note Content Preview: {}",
            noteContent.length() > 200 ? noteContent.substring(0, 200) + "..." : noteContent);

        // 언어별 SYSTEM_PROMPT 생성
        String systemPrompt = buildSystemPrompt(language);

        // 사용자 프롬프트 구성
        String userPrompt = String.format(
            "Book Title: %s\n\nDiscussion Notes:\n%s",
            bookTitle, noteContent
        );

        // OpenAI API 호출
        OpenAiResponse response = openAiClient.getChatCompletion(systemPrompt, userPrompt);

        if (response != null && response.getContent() != null) {
            logger.info("Successfully received response from OpenAI");
            return parseSummaryFromJson(response.getContent());
        } else {
            logger.warn("Failed to get response from OpenAI - returning mock summary");
            return createMockSummary(bookTitle, language);
        }
    }

    /**
     * JSON 응답을 AISummary 객체로 파싱
     */
    private AISummary parseSummaryFromJson(String json) {
        AISummary summary = new AISummary();
        summary.setGeneratedAt(LocalDateTime.now());
        summary.setModelUsed(MODEL);

        try {
            // Clean up JSON (remove markdown code blocks if present)
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

            logger.info("Parsing JSON response...");
            JsonNode root = objectMapper.readTree(json);

            // Extract oneLiner
            summary.setOneLiner(root.path("oneLiner").asText("Summary generated successfully."));

            // Extract keyPoints
            List<String> keyPoints = new ArrayList<>();
            JsonNode keyPointsNode = root.path("keyPoints");
            if (keyPointsNode.isArray()) {
                for (JsonNode point : keyPointsNode) {
                    keyPoints.add(point.asText());
                }
            }
            summary.setKeyPoints(keyPoints.isEmpty() ?
                Arrays.asList("Key point from discussion") : keyPoints);

            // Extract quotes
            List<String> quotes = new ArrayList<>();
            JsonNode quotesNode = root.path("quotes");
            if (quotesNode.isArray()) {
                for (JsonNode quote : quotesNode) {
                    quotes.add(quote.asText());
                }
            }
            summary.setQuotes(quotes.isEmpty() ?
                Arrays.asList("Notable quote from the discussion") : quotes);

            // Extract agreements
            List<Agreement> agreements = new ArrayList<>();
            JsonNode agreementsNode = root.path("agreements");
            if (agreementsNode.isArray()) {
                for (JsonNode agr : agreementsNode) {
                    String point = agr.path("point").asText();
                    boolean isAgreement = agr.path("isAgreement").asBoolean(true);
                    agreements.add(new Agreement(point, isAgreement));
                }
            }
            summary.setAgreements(agreements.isEmpty() ?
                Arrays.asList(new Agreement("General agreement point", true)) : agreements);

            // Extract openQuestions
            List<String> openQuestions = new ArrayList<>();
            JsonNode questionsNode = root.path("openQuestions");
            if (questionsNode.isArray()) {
                for (JsonNode question : questionsNode) {
                    openQuestions.add(question.asText());
                }
            }
            summary.setOpenQuestions(openQuestions.isEmpty() ?
                Arrays.asList("Question to explore further") : openQuestions);

            logger.info("Successfully parsed AI summary");
            logger.info("OneLiner: {}", summary.getOneLiner());

        } catch (Exception e) {
            logger.error("Failed to parse JSON response: {}", e.getMessage());
            logger.error("Raw JSON: {}", json);
            // Fallback values
            summary.setOneLiner("Summary generation completed.");
            summary.setKeyPoints(Arrays.asList("Key point 1", "Key point 2"));
            summary.setQuotes(Arrays.asList("Notable quote from discussion"));
            summary.setOpenQuestions(Arrays.asList("Questions to explore further"));
            summary.setAgreements(Arrays.asList(
                new Agreement("General agreement point", true),
                new Agreement("Point of discussion", false)
            ));
        }

        return summary;
    }

    /**
     * Mock 요약 생성 (API 키가 없거나 오류 발생 시)
     */
    private AISummary createMockSummary(String bookTitle, String language) {
        logger.info("Creating mock summary for: {} (language: {})", bookTitle, language);

        AISummary summary = new AISummary();

        boolean isKorean = "ko".equalsIgnoreCase(language) || "kr".equalsIgnoreCase(language);

        if (isKorean) {
            summary.setOneLiner(bookTitle + "에 대한 토론은 모든 참여자들의 흥미로운 관점과 함께 핵심 주제를 탐구했습니다.");
            summary.setKeyPoints(Arrays.asList(
                "캐릭터 개발이 주요 주제였습니다",
                "서사 구조가 토론을 촉발했습니다",
                "정체성과 소속감의 주제가 중심이었습니다",
                "역사적 맥락이 이해를 높였습니다"
            ));
            summary.setQuotes(Arrays.asList(
                "이 책은 제 관점을 완전히 바꿔놓았습니다",
                "작가의 상징 사용이 훌륭했습니다"
            ));
            summary.setAgreements(Arrays.asList(
                new Agreement("책의 결말이 만족스러웠다", true),
                new Agreement("중반부의 전개 속도", false)
            ));
            summary.setOpenQuestions(Arrays.asList(
                "이 책을 작가의 다른 작품들과 어떻게 비교할 수 있을까?",
                "현대 배경에서 캐릭터들은 어떻게 행동할까?"
            ));
        } else {
            summary.setOneLiner("The discussion explored key themes in " + bookTitle + " with engaging perspectives from all participants.");
            summary.setKeyPoints(Arrays.asList(
                "Character development was a major topic",
                "The narrative structure sparked debate",
                "Themes of identity and belonging were central",
                "Historical context enhanced understanding"
            ));
            summary.setQuotes(Arrays.asList(
                "This book changed my perspective on the topic",
                "The author's use of symbolism was masterful"
            ));
            summary.setAgreements(Arrays.asList(
                new Agreement("The book's ending was satisfying", true),
                new Agreement("The pacing in the middle section", false)
            ));
            summary.setOpenQuestions(Arrays.asList(
                "How does this book compare to the author's other works?",
                "What would the characters do in a modern setting?"
            ));
        }

        summary.setGeneratedAt(LocalDateTime.now());
        summary.setModelUsed("mock-model");
        return summary;
    }
}
