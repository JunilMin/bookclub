package com.bookclub.backend.moderation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Perspective API를 사용한 텍스트 독성 분석 서비스
 */
@Service
public class PerspectiveService {

    private static final Logger logger = LoggerFactory.getLogger(PerspectiveService.class);

    @Value("${perspective.api.key:}")
    private String apiKey;

    private static final String PERSPECTIVE_API_URL =
        "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

    // 독성 임계값 (0.0 ~ 1.0) - 이 값 이상이면 비속어로 판단
    private static final double TOXICITY_THRESHOLD = 0.7;

    private final RestTemplate restTemplate;

    public PerspectiveService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * 텍스트의 독성을 분석합니다.
     * @param text 분석할 텍스트
     * @return 분석 결과 (독성 점수 및 비속어 여부)
     */
    public ToxicityResult analyzeToxicity(String text) {
        if (apiKey == null || apiKey.isEmpty()) {
            logger.warn("Perspective API key is not configured. Skipping toxicity check.");
            return new ToxicityResult(false, 0.0, "API key not configured");
        }

        try {
            String url = PERSPECTIVE_API_URL + "?key=" + apiKey;

            // 요청 본문 구성
            Map<String, Object> requestBody = new HashMap<>();

            Map<String, String> comment = new HashMap<>();
            comment.put("text", text);
            requestBody.put("comment", comment);

            // 분석할 속성들
            Map<String, Object> requestedAttributes = new HashMap<>();
            requestedAttributes.put("TOXICITY", new HashMap<>());
            requestedAttributes.put("PROFANITY", new HashMap<>());
            requestedAttributes.put("INSULT", new HashMap<>());
            requestBody.put("requestedAttributes", requestedAttributes);

            // 언어 설정 (한국어와 영어 지원)
            requestBody.put("languages", List.of("ko", "en"));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return parseResponse(response.getBody());
            }

            return new ToxicityResult(false, 0.0, "API response error");

        } catch (Exception e) {
            logger.error("Perspective API call failed: {}", e.getMessage());
            // API 호출 실패 시 통과 처리 (false positive 방지)
            return new ToxicityResult(false, 0.0, "API call failed: " + e.getMessage());
        }
    }

    /**
     * API 응답을 파싱하여 독성 결과를 반환합니다.
     */
    @SuppressWarnings("unchecked")
    private ToxicityResult parseResponse(Map<String, Object> responseBody) {
        try {
            Map<String, Object> attributeScores = (Map<String, Object>) responseBody.get("attributeScores");

            double maxScore = 0.0;
            String detectedAttribute = "";

            // TOXICITY, PROFANITY, INSULT 중 가장 높은 점수 확인
            for (String attribute : List.of("TOXICITY", "PROFANITY", "INSULT")) {
                if (attributeScores.containsKey(attribute)) {
                    Map<String, Object> attrData = (Map<String, Object>) attributeScores.get(attribute);
                    Map<String, Object> summaryScore = (Map<String, Object>) attrData.get("summaryScore");
                    double score = ((Number) summaryScore.get("value")).doubleValue();

                    if (score > maxScore) {
                        maxScore = score;
                        detectedAttribute = attribute;
                    }
                }
            }

            boolean isToxic = maxScore >= TOXICITY_THRESHOLD;
            String message = isToxic
                ? String.format("Detected %s with score %.2f", detectedAttribute, maxScore)
                : "No toxicity detected";

            logger.info("Toxicity analysis for text: score={}, toxic={}", maxScore, isToxic);

            return new ToxicityResult(isToxic, maxScore, message);

        } catch (Exception e) {
            logger.error("Failed to parse Perspective API response: {}", e.getMessage());
            return new ToxicityResult(false, 0.0, "Parse error");
        }
    }

    /**
     * 독성 분석 결과를 담는 클래스
     */
    public static class ToxicityResult {
        private final boolean toxic;
        private final double score;
        private final String message;

        public ToxicityResult(boolean toxic, double score, String message) {
            this.toxic = toxic;
            this.score = score;
            this.message = message;
        }

        public boolean isToxic() {
            return toxic;
        }

        public double getScore() {
            return score;
        }

        public String getMessage() {
            return message;
        }
    }
}
