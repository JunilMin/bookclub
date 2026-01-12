package com.bookclub.backend.session.model;

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

    private CurrentSpeaker currentSpeaker;

    private List<QueuedParticipant> queue = new ArrayList<>();

    private List<SessionParticipant> participants = new ArrayList<>();

    public SpeakingQueue(String sessionId) {
        this.sessionId = sessionId;
        this.queue = new ArrayList<>();
        this.participants = new ArrayList<>();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class CurrentSpeaker {
        private String odUserId;
        private String username;
        private String photoUrl;
        private LocalDateTime startedAt;
        private int speakingTimeSeconds;  // Max speaking time in seconds

        public CurrentSpeaker(String odUserId, String username, String photoUrl, int speakingTimeSeconds) {
            this.odUserId = odUserId;
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
        private String odUserId;
        private String username;
        private String photoUrl;
        private LocalDateTime queuedAt;
        private int position;

        public QueuedParticipant(String odUserId, String username, String photoUrl, int position) {
            this.odUserId = odUserId;
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
        private String odUserId;
        private String username;
        private String photoUrl;
        private boolean isHost;
        private boolean hasRaisedHand;
        private boolean isOnline;
        private LocalDateTime joinedAt;

        public SessionParticipant(String odUserId, String username, String photoUrl, boolean isHost) {
            this.odUserId = odUserId;
            this.username = username;
            this.photoUrl = photoUrl;
            this.isHost = isHost;
            this.hasRaisedHand = false;
            this.isOnline = true;
            this.joinedAt = LocalDateTime.now();
        }
    }
}
