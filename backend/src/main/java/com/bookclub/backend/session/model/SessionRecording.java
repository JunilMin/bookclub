package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "session_recordings")
@Getter
@Setter
@NoArgsConstructor
public class SessionRecording {
    @Id
    private String id;

    private String sessionId;

    private boolean isRecording;

    private LocalDateTime recordingStartedAt;

    private LocalDateTime recordingEndedAt;

    private long recordingDurationSeconds;

    private AISummary aiSummary;

    // STT/Utterance settings
    /** Language policy for STT: "auto", "ko", or "en" */
    private String languagePolicy;

    /** Whether to automatically insert utterances to collaborative notes */
    private boolean autoInsertToNotes;

    /** Total number of utterances in this session */
    private int utteranceCount;

    /** Timestamp of the last utterance */
    private LocalDateTime lastUtteranceAt;

    /** Total audio duration processed (in milliseconds) for cost tracking */
    private long totalAudioDurationMs;

    /** Total LLM tokens used for cost tracking */
    private int totalTokensUsed;

    public SessionRecording(String sessionId) {
        this.sessionId = sessionId;
        this.isRecording = false;
        this.languagePolicy = "auto";
        this.autoInsertToNotes = false;
        this.utteranceCount = 0;
        this.totalAudioDurationMs = 0;
        this.totalTokensUsed = 0;
    }

    public void incrementUtteranceCount() {
        this.utteranceCount++;
        this.lastUtteranceAt = LocalDateTime.now();
    }

    public void addAudioDuration(long durationMs) {
        this.totalAudioDurationMs += durationMs;
    }

    public void addTokensUsed(int tokens) {
        this.totalTokensUsed += tokens;
    }

    public void startRecording() {
        this.isRecording = true;
        this.recordingStartedAt = LocalDateTime.now();
        this.recordingEndedAt = null;
        this.recordingDurationSeconds = 0;
    }

    public void stopRecording() {
        this.isRecording = false;
        this.recordingEndedAt = LocalDateTime.now();
        if (recordingStartedAt != null) {
            this.recordingDurationSeconds = java.time.Duration.between(recordingStartedAt, recordingEndedAt).getSeconds();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class AISummary {
        private String oneLiner;
        private List<String> keyPoints;
        private List<String> quotes;
        private List<Agreement> agreements;
        private List<String> openQuestions;
        private LocalDateTime generatedAt;
        private String modelUsed;

        @Getter
        @Setter
        @NoArgsConstructor
        public static class Agreement {
            private String point;
            private boolean isAgreement;  // true = agreement, false = disagreement

            public Agreement(String point, boolean isAgreement) {
                this.point = point;
                this.isAgreement = isAgreement;
            }
        }
    }
}
