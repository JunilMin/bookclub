package com.bookclub.backend.session.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "speaking_queues")
@Getter
@Setter
@NoArgsConstructor
public class SpeakingQueue {
    @Id
    private String id;

    private String sessionId;

    private String moderatorId;  // Current moderator's userId (can be delegated)

    private VoiceChatMode voiceChatMode = VoiceChatMode.RULES;  // Default to rules mode

    // In RULES mode: after a speaker finishes, moderator gets a turn before the next speaker
    private boolean isModeratorTurn = false;

    private CurrentSpeaker currentSpeaker;

    // Voice Chat Mode enum
    public enum VoiceChatMode {
        RULES,  // Hand-raise only mode - only current speaker can speak
        FREE    // Free mode - everyone can speak freely
    }

    private List<QueuedParticipant> queue = new ArrayList<>();

    private List<SessionParticipant> participants = new ArrayList<>();

    private List<SpeakingHistoryEntry> speakingHistory = new ArrayList<>();

    public SpeakingQueue(String sessionId) {
        this.sessionId = sessionId;
        this.voiceChatMode = VoiceChatMode.RULES;
        this.queue = new ArrayList<>();
        this.participants = new ArrayList<>();
        this.speakingHistory = new ArrayList<>();
    }

    public SpeakingQueue(String sessionId, String moderatorId) {
        this.sessionId = sessionId;
        this.moderatorId = moderatorId;
        this.voiceChatMode = VoiceChatMode.RULES;
        this.queue = new ArrayList<>();
        this.participants = new ArrayList<>();
        this.speakingHistory = new ArrayList<>();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class CurrentSpeaker {
        private String userId;  // User ObjectId
        private String username;
        private String photoUrl;
        private LocalDateTime startedAt;
        private int speakingTimeSeconds;  // Max speaking time in seconds

        public CurrentSpeaker(String userId, String username, String photoUrl, int speakingTimeSeconds) {
            this.userId = userId;
            this.username = username;
            this.photoUrl = photoUrl;
            this.startedAt = LocalDateTime.now();
            this.speakingTimeSeconds = speakingTimeSeconds;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class QueuedParticipant {
        private String userId;  // User ObjectId
        private String username;
        private String photoUrl;
        private LocalDateTime queuedAt;
        private int position;

        public QueuedParticipant(String userId, String username, String photoUrl, int position) {
            this.userId = userId;
            this.username = username;
            this.photoUrl = photoUrl;
            this.queuedAt = LocalDateTime.now();
            this.position = position;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class SessionParticipant {
        private String userId;  // User ObjectId
        private String username;
        private String photoUrl;

        @JsonProperty("isHost")
        private boolean isHost;

        private boolean hasRaisedHand;

        @JsonProperty("isOnline")
        private boolean isOnline;

        private LocalDateTime joinedAt;
        private LocalDateTime lastHeartbeat;  // For stale session detection

        public SessionParticipant(String userId, String username, String photoUrl, boolean isHost) {
            this.userId = userId;
            this.username = username;
            this.photoUrl = photoUrl;
            this.isHost = isHost;
            this.hasRaisedHand = false;
            this.isOnline = true;
            this.joinedAt = LocalDateTime.now();
            this.lastHeartbeat = LocalDateTime.now();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class SpeakingHistoryEntry {
        private String userId;  // User ObjectId
        private String username;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private long durationSeconds;
        private int speakCount;  // 해당 사용자의 누적 발언 횟수

        public SpeakingHistoryEntry(String userId, String username, LocalDateTime startTime, LocalDateTime endTime, int speakCount) {
            this.userId = userId;
            this.username = username;
            this.startTime = startTime;
            this.endTime = endTime;
            this.durationSeconds = java.time.Duration.between(startTime, endTime).getSeconds();
            this.speakCount = speakCount;
        }
    }
}
