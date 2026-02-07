package com.bookclub.backend.session.scheduler;

import com.bookclub.backend.session.model.SpeakingQueue;
import com.bookclub.backend.session.service.SpeakingQueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Scheduled task to clean up stale participants.
 * Runs periodically to mark participants as offline if their heartbeat is stale.
 */
@Component
public class StaleParticipantCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(StaleParticipantCleanupScheduler.class);

    @Autowired
    private SpeakingQueueService speakingQueueService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Heartbeat timeout in seconds (default: 60 seconds)
    @Value("${session.heartbeat.timeout:60}")
    private int heartbeatTimeoutSeconds;

    /**
     * Run cleanup every 30 seconds
     */
    @Scheduled(fixedRate = 30000)
    public void cleanupStaleParticipants() {
        logger.debug("Running stale participant cleanup...");

        try {
            // Get all active sessions (sessions with at least one online participant)
            List<String> activeSessionIds = speakingQueueService.getActiveSessionIds();

            if (activeSessionIds.isEmpty()) {
                logger.debug("No active sessions to clean up");
                return;
            }

            int totalMarkedOffline = 0;

            for (String sessionId : activeSessionIds) {
                List<String> markedOffline = speakingQueueService.markStaleParticipantsOffline(
                        sessionId, heartbeatTimeoutSeconds);

                if (!markedOffline.isEmpty()) {
                    logger.info("Marked {} stale participants as offline in session {}: {}",
                            markedOffline.size(), sessionId, markedOffline);

                    // Broadcast updated queue to all subscribers
                    SpeakingQueue updatedQueue = speakingQueueService.getOrCreateQueue(sessionId);
                    messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/queue", updatedQueue);

                    totalMarkedOffline += markedOffline.size();
                }
            }

            if (totalMarkedOffline > 0) {
                logger.info("Cleanup complete: marked {} total participants as offline across {} sessions",
                        totalMarkedOffline, activeSessionIds.size());
            }
        } catch (Exception e) {
            logger.error("Error during stale participant cleanup: {}", e.getMessage(), e);
        }
    }
}
