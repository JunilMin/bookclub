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

    public SessionRecording(String sessionId) {
        this.sessionId = sessionId;
        this.isRecording = false;
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
