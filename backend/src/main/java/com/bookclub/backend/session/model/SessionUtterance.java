package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Represents a single utterance (speech turn) in a session.
 * Contains STT results (rawText), LLM-refined text, and structured summary.
 */
@Document(collection = "session_utterances")
@CompoundIndexes({
    @CompoundIndex(name = "session_utterance_idx", def = "{'sessionId': 1, 'utteranceIndex': 1}", unique = true),
    @CompoundIndex(name = "session_created_idx", def = "{'sessionId': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "speaker_created_idx", def = "{'speakerId': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
public class SessionUtterance {
    @Id
    private String id;

    private String sessionId;

    /** Utterance order number (1, 2, 3...) */
    private int utteranceIndex;

    // Speaker information
    private String speakerId;
    private String speakerName;
    private String speakerPhotoUrl;

    // Time information
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private long durationMs;

    // STT results
    /** Detected or specified language ("ko" or "en") */
    private String language;
    /** STT confidence score (0.0 ~ 1.0) */
    private double confidence;
    /** Raw STT transcription text */
    private String rawText;

    // LLM refined results
    /** LLM-refined text (no abbreviation, context preserved, errors corrected) */
    private String refinedText;

    /** Structured summary */
    private UtteranceSummary summary;

    // Status
    /** Whether this utterance has been inserted into collaborative notes */
    private boolean insertedToNotes;
    private LocalDateTime insertedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SessionUtterance(String sessionId, int utteranceIndex) {
        this.sessionId = sessionId;
        this.utteranceIndex = utteranceIndex;
        this.insertedToNotes = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void markAsInsertedToNotes() {
        this.insertedToNotes = true;
        this.insertedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Structured summary of an utterance containing key points, issues, and topics.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class UtteranceSummary {
        /** Key points from the utterance (2-3 items) */
        private List<String> keyPoints;

        /** Issues or arguments raised (if any) */
        private List<String> issues;

        /** Topics or keywords mentioned */
        private List<String> topics;

        public UtteranceSummary(List<String> keyPoints, List<String> issues, List<String> topics) {
            this.keyPoints = keyPoints;
            this.issues = issues;
            this.topics = topics;
        }
    }
}
