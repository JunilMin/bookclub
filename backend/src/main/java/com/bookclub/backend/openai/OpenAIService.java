package com.bookclub.backend.openai;

import com.bookclub.backend.openai.dto.OpenAiResponse;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AISummary.Agreement;
import com.bookclub.backend.session.model.SessionRecording.AIOrganizedContent;
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

        // Convert TipTap JSON to plain text if needed
        String plainTextContent = noteContent;
        if (noteContent != null && noteContent.trim().startsWith("{")) {
            logger.info("Detected TipTap JSON format, converting to plain text...");
            plainTextContent = convertTipTapToPlainText(noteContent);
            logger.info("Converted to plain text: {} chars", plainTextContent.length());
        }

        // 노트 내용이 너무 짧으면 mock 반환
        if (plainTextContent == null || plainTextContent.trim().length() < 50) {
            logger.warn("Note content is too short ({} chars) - returning mock summary",
                plainTextContent != null ? plainTextContent.length() : 0);
            return createMockSummary(bookTitle, language);
        }

        // 노트 내용 미리보기
        logger.info("Note Content Preview: {}",
            plainTextContent.length() > 200 ? plainTextContent.substring(0, 200) + "..." : plainTextContent);

        // 언어별 SYSTEM_PROMPT 생성
        String systemPrompt = buildSystemPrompt(language);

        // 사용자 프롬프트 구성
        String userPrompt = String.format(
            "Book Title: %s\n\nDiscussion Notes:\n%s",
            bookTitle, plainTextContent
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

    // =========================================================================
    // AI Context-Preserving Editor Methods
    // =========================================================================

    /**
     * Build system prompt for context-preserving organization
     */
    private String buildOrganizeSystemPrompt(String language) {
        String languageInstruction;
        if ("ko".equalsIgnoreCase(language) || "kr".equalsIgnoreCase(language)) {
            languageInstruction = "IMPORTANT: You MUST respond in Korean (한국어). Keep fragment markers as-is.";
        } else {
            languageInstruction = "IMPORTANT: You MUST respond in English. Keep fragment markers as-is.";
        }

        return """
            You are an AI editor that reorganizes discussion notes for better readability.

            YOUR ROLE IS TO REORGANIZE, NOT TO SUMMARIZE.

            CRITICAL RULES:
            1. PRESERVE ALL CONTENT - Every single fragment must appear in your output exactly once
            2. DO NOT DELETE anything - reorganization only, no content loss
            3. DO NOT ADD new content - only reorganize existing fragments
            4. Each fragment is marked with ⟦note_XXX⟧ - these markers MUST be preserved
            5. You may reorder fragments to group related topics together
            6. You may add section headers to organize content
            7. You may add brief transitional phrases between sections

            %s

            INPUT FORMAT:
            The input will contain fragments like:
            ⟦note_001⟧ Some discussion point here
            ⟦note_002⟧ Another point about the book

            OUTPUT FORMAT (JSON):
            {
                "sections": [
                    {
                        "title": "Section Title (e.g., 'Character Analysis')",
                        "fragments": ["note_001", "note_003"]
                    },
                    {
                        "title": "Another Section",
                        "fragments": ["note_002", "note_004"]
                    }
                ],
                "organizedText": "Full reorganized text with all fragments preserved in new order"
            }

            VALIDATION: Your output MUST contain ALL fragment IDs from the input.
            If there are N fragments in input, there must be exactly N fragments in output.
            """.formatted(languageInstruction);
    }

    /**
     * Extract fragment IDs from text (format: ⟦note_XXX⟧)
     */
    public List<String> extractFragmentIds(String text) {
        List<String> fragmentIds = new ArrayList<>();
        if (text == null) return fragmentIds;

        // Pattern: ⟦note_XXX⟧
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("⟦(note_\\d{3})⟧");
        java.util.regex.Matcher matcher = pattern.matcher(text);

        while (matcher.find()) {
            fragmentIds.add(matcher.group(1));
        }

        return fragmentIds;
    }

    /**
     * Convert TipTap JSON content to plain text.
     * Extracts text from the JSON structure recursively.
     */
    public String convertTipTapToPlainText(String jsonContent) {
        if (jsonContent == null || jsonContent.trim().isEmpty()) {
            return "";
        }

        try {
            JsonNode root = objectMapper.readTree(jsonContent);
            StringBuilder plainText = new StringBuilder();
            extractTextFromNode(root, plainText);
            return plainText.toString().trim();
        } catch (Exception e) {
            logger.warn("Failed to parse TipTap JSON, returning as-is: {}", e.getMessage());
            // If it's not valid JSON, return as-is (might already be plain text)
            return jsonContent;
        }
    }

    /**
     * Recursively extract text from TipTap JSON nodes.
     */
    private void extractTextFromNode(JsonNode node, StringBuilder result) {
        if (node == null) return;

        // If this node has "text" field, extract it
        if (node.has("text")) {
            result.append(node.get("text").asText());
        }

        // If this node has "content" array, process children
        if (node.has("content") && node.get("content").isArray()) {
            JsonNode content = node.get("content");
            for (JsonNode child : content) {
                extractTextFromNode(child, result);
            }
        }

        // Add appropriate whitespace based on node type
        if (node.has("type")) {
            String type = node.get("type").asText();
            switch (type) {
                case "paragraph":
                case "heading":
                case "blockquote":
                case "listItem":
                    result.append("\n\n");
                    break;
                case "hardBreak":
                    result.append("\n");
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Add fragment IDs to plain text content.
     * Splits by sentences/paragraphs and assigns IDs.
     */
    public String addFragmentIds(String content) {
        if (content == null || content.trim().isEmpty()) {
            return content;
        }

        StringBuilder result = new StringBuilder();
        int fragmentCounter = 1;

        // Split by paragraphs (double newline) or sentences
        String[] paragraphs = content.split("\\n\\s*\\n");

        for (String paragraph : paragraphs) {
            String trimmed = paragraph.trim();
            if (!trimmed.isEmpty()) {
                String fragmentId = String.format("⟦note_%03d⟧", fragmentCounter++);
                result.append(fragmentId).append(" ").append(trimmed).append("\n\n");
            }
        }

        return result.toString().trim();
    }

    /**
     * Organize notes using AI while preserving all content.
     * @param bookTitle Book title for context
     * @param noteContent Note content (may or may not have fragment IDs)
     * @param language Output language ("ko" or "en")
     */
    public AIOrganizedContent organizeNotes(String bookTitle, String noteContent, String language) {
        logger.info("=== AI Context-Preserving Editor Started ===");
        logger.info("Book Title: {}", bookTitle);
        logger.info("Language: {}", language);

        AIOrganizedContent result = new AIOrganizedContent();
        result.setGeneratedAt(LocalDateTime.now());

        // Check API configuration
        if (!openAiClient.isConfigured()) {
            logger.warn("OpenAI API Key is NOT configured - returning mock organized content");
            return createMockOrganizedContent(noteContent, language);
        }

        // Convert TipTap JSON to plain text if needed
        String plainTextContent = noteContent;
        if (noteContent != null && noteContent.trim().startsWith("{")) {
            logger.info("Detected TipTap JSON format, converting to plain text...");
            plainTextContent = convertTipTapToPlainText(noteContent);
            logger.info("Converted to plain text: {} chars", plainTextContent.length());
        }

        // Check content length
        if (plainTextContent == null || plainTextContent.trim().length() < 30) {
            logger.warn("Note content is too short ({} chars)",
                plainTextContent != null ? plainTextContent.length() : 0);
            return createMockOrganizedContent(plainTextContent, language);
        }

        // Add fragment IDs if not present
        String contentWithIds = plainTextContent;
        if (!plainTextContent.contains("⟦note_")) {
            contentWithIds = addFragmentIds(plainTextContent);
            logger.info("Added fragment IDs to content");
        }

        // Extract source fragment IDs
        List<String> sourceFragmentIds = extractFragmentIds(contentWithIds);
        result.setSourceFragmentIds(sourceFragmentIds);
        logger.info("Source fragment count: {}", sourceFragmentIds.size());

        // Build prompts
        String systemPrompt = buildOrganizeSystemPrompt(language);
        String userPrompt = String.format(
            "Book Title: %s\n\nDiscussion Notes with Fragment IDs:\n%s",
            bookTitle, contentWithIds
        );

        // Call OpenAI API with higher max tokens (4000) for organize feature
        // The organize feature needs to preserve ALL content, so it requires more tokens
        OpenAiResponse response = openAiClient.getChatCompletion(systemPrompt, userPrompt, 4000);

        if (response != null && response.getContent() != null) {
            logger.info("Successfully received organization response from OpenAI");
            return parseOrganizedContent(response.getContent(), sourceFragmentIds);
        } else {
            logger.warn("Failed to get response from OpenAI - returning mock organized content");
            return createMockOrganizedContent(contentWithIds, language);
        }
    }

    /**
     * Parse the AI response and validate fragment preservation
     */
    private AIOrganizedContent parseOrganizedContent(String json, List<String> sourceFragmentIds) {
        AIOrganizedContent result = new AIOrganizedContent();
        result.setGeneratedAt(LocalDateTime.now());
        result.setModelUsed(MODEL);
        result.setSourceFragmentIds(sourceFragmentIds);

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

            logger.info("Parsing organized content JSON...");
            logger.info("Raw JSON (first 500 chars): {}", json.length() > 500 ? json.substring(0, 500) : json);

            JsonNode root = objectMapper.readTree(json);

            // Extract organized text
            String organizedText = root.path("organizedText").asText("");
            logger.info("Extracted organizedText length: {} chars", organizedText.length());
            logger.info("OrganizedText preview: {}", organizedText.length() > 300 ? organizedText.substring(0, 300) : organizedText);
            result.setOrganizedText(organizedText);

            // Extract fragment IDs from output
            List<String> outputFragmentIds = extractFragmentIds(organizedText);
            result.setOutputFragmentIds(outputFragmentIds);

            // Validate: all source fragments must be in output
            List<String> missingFragments = new ArrayList<>();
            for (String sourceId : sourceFragmentIds) {
                if (!outputFragmentIds.contains(sourceId)) {
                    missingFragments.add(sourceId);
                }
            }
            result.setMissingFragments(missingFragments);

            // Check validity
            if (missingFragments.isEmpty()) {
                result.setValid(true);
                logger.info("Validation passed: all {} fragments preserved", sourceFragmentIds.size());
            } else {
                result.setValid(false);
                result.setValidationError("Missing fragments: " + String.join(", ", missingFragments));
                logger.warn("Validation failed: {} fragments missing", missingFragments.size());
            }

        } catch (Exception e) {
            logger.error("Failed to parse organized content: {}", e.getMessage());
            logger.error("Raw JSON that failed to parse: {}", json);

            // Try to extract organizedText even if JSON parsing fails
            // Sometimes the AI response has the text but with malformed JSON structure
            String fallbackText = extractOrganizedTextFallback(json);
            if (fallbackText != null && !fallbackText.isEmpty()) {
                logger.info("Using fallback text extraction, length: {}", fallbackText.length());
                result.setOrganizedText(fallbackText);
                List<String> outputIds = extractFragmentIds(fallbackText);
                result.setOutputFragmentIds(outputIds);

                // Check for missing fragments
                List<String> missing = new ArrayList<>();
                for (String id : sourceFragmentIds) {
                    if (!outputIds.contains(id)) {
                        missing.add(id);
                    }
                }
                result.setMissingFragments(missing);
                result.setValid(missing.isEmpty());
                if (!missing.isEmpty()) {
                    result.setValidationError("Parse error, used fallback. Missing: " + String.join(", ", missing));
                }
            } else {
                result.setValid(false);
                result.setValidationError("Parse error: " + e.getMessage());
                result.setOrganizedText("");
                result.setOutputFragmentIds(new ArrayList<>());
                result.setMissingFragments(sourceFragmentIds);
            }
        }

        return result;
    }

    /**
     * Fallback method to extract organizedText from malformed JSON
     */
    private String extractOrganizedTextFallback(String json) {
        if (json == null) return null;

        // Try to find "organizedText" value even in malformed JSON
        int startIndex = json.indexOf("\"organizedText\"");
        if (startIndex == -1) return null;

        // Find the start of the value (after the colon and opening quote)
        int colonIndex = json.indexOf(":", startIndex);
        if (colonIndex == -1) return null;

        int valueStart = json.indexOf("\"", colonIndex + 1);
        if (valueStart == -1) return null;

        // Find the end (look for closing quote that's not escaped)
        StringBuilder text = new StringBuilder();
        boolean escaped = false;
        for (int i = valueStart + 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (escaped) {
                // Handle escape sequences
                switch (c) {
                    case 'n': text.append('\n'); break;
                    case 'r': text.append('\r'); break;
                    case 't': text.append('\t'); break;
                    case '"': text.append('"'); break;
                    case '\\': text.append('\\'); break;
                    default: text.append(c);
                }
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                // Found the closing quote
                return text.toString();
            } else {
                text.append(c);
            }
        }

        // If we reached here, the string was truncated - return what we have
        if (text.length() > 0) {
            logger.info("Extracted truncated organizedText, length: {}", text.length());
            return text.toString();
        }

        return null;
    }

    /**
     * Create mock organized content for testing or fallback
     */
    private AIOrganizedContent createMockOrganizedContent(String content, String language) {
        logger.info("Creating mock organized content...");
        AIOrganizedContent result = new AIOrganizedContent();
        result.setGeneratedAt(LocalDateTime.now());
        result.setModelUsed("mock-model");

        if (content == null || content.trim().isEmpty()) {
            logger.info("Content is empty, returning empty mock");
            result.setOrganizedText("");
            result.setSourceFragmentIds(new ArrayList<>());
            result.setOutputFragmentIds(new ArrayList<>());
            result.setMissingFragments(new ArrayList<>());
            result.setValid(true);
            return result;
        }

        // Convert TipTap JSON to plain text if needed
        String plainContent = content;
        if (content.trim().startsWith("{")) {
            logger.info("Detected TipTap JSON in mock, converting...");
            plainContent = convertTipTapToPlainText(content);
        }

        // Add fragment IDs if not present
        String contentWithIds = plainContent;
        if (!plainContent.contains("⟦note_")) {
            contentWithIds = addFragmentIds(plainContent);
            logger.info("Added fragment IDs to mock content");
        }

        List<String> fragmentIds = extractFragmentIds(contentWithIds);
        result.setSourceFragmentIds(fragmentIds);
        result.setOutputFragmentIds(fragmentIds);
        result.setMissingFragments(new ArrayList<>());
        result.setValid(true);

        // For mock, just return content as-is with a header
        boolean isKorean = "ko".equalsIgnoreCase(language) || "kr".equalsIgnoreCase(language);
        String header = isKorean ? "## 정리된 노트\n\n" : "## Organized Notes\n\n";
        result.setOrganizedText(header + contentWithIds);

        logger.info("Mock organized content created: {} fragments, valid={}", fragmentIds.size(), result.isValid());
        return result;
    }
}
