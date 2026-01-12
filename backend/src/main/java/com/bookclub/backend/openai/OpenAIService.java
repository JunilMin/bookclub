package com.bookclub.backend.openai;

import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AISummary.Agreement;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class OpenAIService {

    @Autowired(required = false)
    private OpenAiService openAiService;

    private static final String MODEL = "gpt-4o-mini";

    private static final String SYSTEM_PROMPT = """
        You are an AI assistant that summarizes book club discussions. Given the discussion notes, provide:
        1. A one-line summary (1 sentence)
        2. Key discussion points (3-5 bullet points)
        3. Notable quotes mentioned (2-3)
        4. Points of agreement and disagreement
        5. Open questions for future discussion (2-3)

        Format your response as JSON:
        {
            "oneLiner": "...",
            "keyPoints": ["...", "..."],
            "quotes": ["...", "..."],
            "agreements": [
                {"point": "...", "isAgreement": true},
                {"point": "...", "isAgreement": false}
            ],
            "openQuestions": ["...", "..."]
        }
        """;

    public AISummary generateSummary(String bookTitle, String noteContent) {
        if (openAiService == null) {
            return createMockSummary(bookTitle);
        }

        try {
            List<ChatMessage> messages = new ArrayList<>();
            messages.add(new ChatMessage("system", SYSTEM_PROMPT));
            messages.add(new ChatMessage("user",
                    "Book: " + bookTitle + "\n\nDiscussion Notes:\n" + noteContent));

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(MODEL)
                    .messages(messages)
                    .temperature(0.7)
                    .maxTokens(1000)
                    .build();

            String response = openAiService.createChatCompletion(request)
                    .getChoices().get(0).getMessage().getContent();

            return parseSummaryFromJson(response);

        } catch (Exception e) {
            e.printStackTrace();
            return createMockSummary(bookTitle);
        }
    }

    private AISummary parseSummaryFromJson(String json) {
        AISummary summary = new AISummary();
        summary.setGeneratedAt(LocalDateTime.now());
        summary.setModelUsed(MODEL);

        try {
            // Simple JSON parsing (in production, use Jackson ObjectMapper)
            json = json.trim();
            if (json.startsWith("```json")) {
                json = json.substring(7);
            }
            if (json.endsWith("```")) {
                json = json.substring(0, json.length() - 3);
            }

            // Extract oneLiner
            int oneLineStart = json.indexOf("\"oneLiner\"") + 13;
            int oneLineEnd = json.indexOf("\"", oneLineStart);
            summary.setOneLiner(json.substring(oneLineStart, oneLineEnd));

            // Extract keyPoints
            summary.setKeyPoints(extractArrayFromJson(json, "keyPoints"));

            // Extract quotes
            summary.setQuotes(extractArrayFromJson(json, "quotes"));

            // Extract openQuestions
            summary.setOpenQuestions(extractArrayFromJson(json, "openQuestions"));

            // Extract agreements
            List<Agreement> agreements = new ArrayList<>();
            int agreementsStart = json.indexOf("\"agreements\"");
            if (agreementsStart > 0) {
                int arrayStart = json.indexOf("[", agreementsStart);
                int arrayEnd = json.indexOf("]", arrayStart) + 1;
                String agreementsJson = json.substring(arrayStart, arrayEnd);

                // Simple parsing for agreements
                int pos = 0;
                while ((pos = agreementsJson.indexOf("\"point\"", pos)) > 0) {
                    int pointStart = agreementsJson.indexOf("\"", pos + 8) + 1;
                    int pointEnd = agreementsJson.indexOf("\"", pointStart);
                    String point = agreementsJson.substring(pointStart, pointEnd);

                    int isAgreementIdx = agreementsJson.indexOf("\"isAgreement\"", pos);
                    boolean isAgreement = agreementsJson.indexOf("true", isAgreementIdx) <
                            agreementsJson.indexOf("}", isAgreementIdx);

                    agreements.add(new Agreement(point, isAgreement));
                    pos = pointEnd + 1;
                }
            }
            summary.setAgreements(agreements);

        } catch (Exception e) {
            // Fallback to simple values if parsing fails
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

    private List<String> extractArrayFromJson(String json, String fieldName) {
        List<String> result = new ArrayList<>();
        try {
            int fieldStart = json.indexOf("\"" + fieldName + "\"");
            if (fieldStart < 0) return result;

            int arrayStart = json.indexOf("[", fieldStart);
            int arrayEnd = json.indexOf("]", arrayStart);
            String arrayContent = json.substring(arrayStart + 1, arrayEnd);

            // Split by comma, but respect quotes
            String[] items = arrayContent.split("\",\\s*\"");
            for (String item : items) {
                item = item.trim().replaceAll("^\"|\"$", "");
                if (!item.isEmpty()) {
                    result.add(item);
                }
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        return result;
    }

    private AISummary createMockSummary(String bookTitle) {
        AISummary summary = new AISummary();
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
        summary.setGeneratedAt(LocalDateTime.now());
        summary.setModelUsed("mock-model");
        return summary;
    }
}
