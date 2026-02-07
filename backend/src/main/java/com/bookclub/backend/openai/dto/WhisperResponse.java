package com.bookclub.backend.openai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response from OpenAI Whisper API transcription
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WhisperResponse {

    /** Transcribed text */
    private String text;

    /** Detected or specified language code (e.g., "ko", "en") */
    private String language;

    /** Audio duration in seconds */
    private double duration;

    /** Word-level or segment-level timestamps (optional, depends on response_format) */
    private List<Segment> segments;

    /** Calculated average confidence from segments */
    private double confidence;

    /**
     * Calculate confidence from segments if available
     */
    public void calculateConfidence() {
        if (segments != null && !segments.isEmpty()) {
            double avgLogprob = segments.stream()
                .mapToDouble(Segment::getAvgLogprob)
                .average()
                .orElse(-1.0);
            // Convert log probability to a 0-1 confidence score
            // Log probabilities are typically negative, closer to 0 = higher confidence
            this.confidence = Math.exp(avgLogprob);
        } else {
            this.confidence = 0.9; // Default confidence when segments not available
        }
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Segment {
        private int id;
        private double start;
        private double end;
        private String text;

        @JsonProperty("avg_logprob")
        private double avgLogprob;

        @JsonProperty("no_speech_prob")
        private double noSpeechProb;
    }
}
