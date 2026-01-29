package com.bookclub.backend.session.service;

import com.bookclub.backend.openai.UtteranceRefinerService;
import com.bookclub.backend.openai.WhisperClient;
import com.bookclub.backend.openai.dto.WhisperResponse;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.SessionUtterance;
import com.bookclub.backend.session.model.SessionUtterance.UtteranceSummary;
import com.bookclub.backend.session.repository.SessionRecordingRepository;
import com.bookclub.backend.session.repository.SessionUtteranceRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Service for processing utterances: STT, refinement, summary, and broadcasting.
 */
@Service
@RequiredArgsConstructor
public class UtteranceService {

    private static final Logger logger = LoggerFactory.getLogger(UtteranceService.class);

    private final SessionUtteranceRepository utteranceRepository;
    private final SessionRecordingRepository recordingRepository;
    private final SessionRepository sessionRepository;
    private final PostRepository postRepository;
    private final WhisperClient whisperClient;
    private final UtteranceRefinerService refinerService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Process an utterance asynchronously.
     * Pipeline: Audio → STT → Refine → Summarize → Save → Broadcast
     */
    @Async
    public CompletableFuture<SessionUtterance> processUtterance(
            String sessionId,
            String speakerId,
            String speakerName,
            String speakerPhotoUrl,
            byte[] audioData,
            String filename,
            LocalDateTime startAt,
            LocalDateTime endAt,
            String languageHint) {

        logger.info("=== Processing Utterance ===");
        logger.info("Session: {}, Speaker: {} ({})", sessionId, speakerName, speakerId);
        logger.info("Audio size: {} bytes, Duration: {} to {}", audioData.length, startAt, endAt);

        try {
            // 1. Get session info for book title
            String bookTitle = getBookTitle(sessionId);
            logger.info("Book title: {}", bookTitle);

            // 2. Get language policy from recording settings
            String language = getLanguagePolicy(sessionId, languageHint);
            logger.info("Language policy: {}", language);

            // Broadcast processing status: transcribing
            broadcastProcessingStatus(sessionId, "transcribing", 20);

            // 3. STT with Whisper
            logger.info("Starting STT...");
            WhisperResponse whisperResponse = whisperClient.transcribe(audioData, filename, language);
            String rawText = whisperResponse.getText();
            String detectedLanguage = whisperResponse.getLanguage();
            double confidence = whisperResponse.getConfidence();
            logger.info("STT complete. Language: {}, Confidence: {}", detectedLanguage, confidence);
            logger.info("Raw text preview: {}", truncate(rawText, 100));

            // Broadcast processing status: refining
            broadcastProcessingStatus(sessionId, "refining", 50);

            // Determine output language for LLM (use user's app language setting, not detected language)
            // If languageHint is "auto" or null, fall back to detected language
            String outputLanguage = (languageHint != null && !languageHint.equalsIgnoreCase("auto"))
                ? languageHint
                : detectedLanguage;
            logger.info("Output language for LLM: {} (hint: {}, detected: {})", outputLanguage, languageHint, detectedLanguage);

            // 4. Refine text with LLM
            logger.info("Starting refinement...");
            String refinedText = refinerService.refineUtterance(rawText, bookTitle, outputLanguage);
            logger.info("Refinement complete. Length: {} chars", refinedText.length());

            // Broadcast processing status: summarizing
            broadcastProcessingStatus(sessionId, "summarizing", 75);

            // 5. Generate summary
            logger.info("Generating summary...");
            UtteranceSummary summary = refinerService.generateSummary(refinedText, outputLanguage);
            logger.info("Summary complete. KeyPoints: {}, Topics: {}",
                summary.getKeyPoints().size(), summary.getTopics().size());

            // 6. Get utterance index atomically (prevents race conditions)
            int utteranceIndex = recordingRepository.incrementAndGetUtteranceCount(sessionId);
            logger.info("Utterance index (atomic): {}", utteranceIndex);

            // 7. Create and save utterance
            SessionUtterance utterance = new SessionUtterance(sessionId, utteranceIndex);
            utterance.setSpeakerId(speakerId);
            utterance.setSpeakerName(speakerName);
            utterance.setSpeakerPhotoUrl(speakerPhotoUrl);
            utterance.setStartAt(startAt);
            utterance.setEndAt(endAt);
            utterance.setDurationMs(Duration.between(startAt, endAt).toMillis());
            utterance.setLanguage(detectedLanguage);
            utterance.setConfidence(confidence);
            utterance.setRawText(rawText);
            utterance.setRefinedText(refinedText);
            utterance.setSummary(summary);
            utterance.setInsertedToNotes(false);
            utterance.setUpdatedAt(LocalDateTime.now());

            SessionUtterance saved = utteranceRepository.save(utterance);
            logger.info("Utterance saved with ID: {}", saved.getId());

            // 8. Update recording stats
            updateRecordingStats(sessionId, (long) (whisperResponse.getDuration() * 1000));

            // 9. Check auto-insert setting and broadcast
            boolean autoInsert = isAutoInsertEnabled(sessionId);

            // Broadcast processing status: complete
            broadcastProcessingStatus(sessionId, "complete", 100);

            // 10. Broadcast new utterance to all clients
            broadcastUtterance(sessionId, saved, autoInsert);

            logger.info("=== Utterance Processing Complete ===");
            return CompletableFuture.completedFuture(saved);

        } catch (Exception e) {
            logger.error("Error processing utterance: {}", e.getMessage(), e);
            broadcastProcessingStatus(sessionId, "error", 0, e.getMessage());
            return CompletableFuture.failedFuture(e);
        }
    }

    /**
     * Get all utterances for a session
     */
    public List<SessionUtterance> getUtterances(String sessionId) {
        return utteranceRepository.findBySessionIdOrderByUtteranceIndexAsc(sessionId);
    }

    /**
     * Get a specific utterance
     */
    public Optional<SessionUtterance> getUtterance(String sessionId, int utteranceIndex) {
        return utteranceRepository.findBySessionIdAndUtteranceIndex(sessionId, utteranceIndex);
    }

    /**
     * Mark an utterance as inserted to notes
     */
    public SessionUtterance markAsInsertedToNotes(String sessionId, int utteranceIndex) {
        Optional<SessionUtterance> utteranceOpt = utteranceRepository
            .findBySessionIdAndUtteranceIndex(sessionId, utteranceIndex);

        if (utteranceOpt.isPresent()) {
            SessionUtterance utterance = utteranceOpt.get();
            utterance.markAsInsertedToNotes();
            return utteranceRepository.save(utterance);
        }

        throw new RuntimeException("Utterance not found: " + sessionId + "/" + utteranceIndex);
    }

    /**
     * Set auto-insert setting for a session
     */
    public void setAutoInsertToNotes(String sessionId, boolean enabled) {
        Optional<SessionRecording> recordingOpt = recordingRepository.findBySessionId(sessionId);
        SessionRecording recording;

        if (recordingOpt.isPresent()) {
            recording = recordingOpt.get();
        } else {
            recording = new SessionRecording(sessionId);
        }

        recording.setAutoInsertToNotes(enabled);
        recordingRepository.save(recording);

        // Broadcast setting change
        Map<String, Object> settingUpdate = new HashMap<>();
        settingUpdate.put("type", "settings");
        settingUpdate.put("autoInsertToNotes", enabled);
        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId + "/utterance-settings",
            settingUpdate
        );
    }

    /**
     * Get auto-insert setting
     */
    public boolean isAutoInsertEnabled(String sessionId) {
        return recordingRepository.findBySessionId(sessionId)
            .map(SessionRecording::isAutoInsertToNotes)
            .orElse(false);
    }

    /**
     * Set language policy for a session
     */
    public void setLanguagePolicy(String sessionId, String languagePolicy) {
        Optional<SessionRecording> recordingOpt = recordingRepository.findBySessionId(sessionId);
        SessionRecording recording;

        if (recordingOpt.isPresent()) {
            recording = recordingOpt.get();
        } else {
            recording = new SessionRecording(sessionId);
        }

        recording.setLanguagePolicy(languagePolicy);
        recordingRepository.save(recording);
    }

    // === Private helper methods ===

    private String getBookTitle(String sessionId) {
        try {
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            if (sessionOpt.isPresent()) {
                String postId = sessionOpt.get().getPostId();
                Optional<Post> postOpt = postRepository.findById(postId);
                if (postOpt.isPresent() && postOpt.get().getBookData() != null) {
                    return postOpt.get().getBookData().getTitle();
                }
            }
        } catch (Exception e) {
            logger.warn("Could not get book title: {}", e.getMessage());
        }
        return "Unknown Book";
    }

    private String getLanguagePolicy(String sessionId, String hint) {
        if (hint != null && !hint.equalsIgnoreCase("auto")) {
            return hint;
        }

        return recordingRepository.findBySessionId(sessionId)
            .map(SessionRecording::getLanguagePolicy)
            .orElse("auto");
    }

    private void updateRecordingStats(String sessionId, long audioDurationMs) {
        Optional<SessionRecording> recordingOpt = recordingRepository.findBySessionId(sessionId);
        SessionRecording recording;

        if (recordingOpt.isPresent()) {
            recording = recordingOpt.get();
        } else {
            recording = new SessionRecording(sessionId);
        }

        // Note: utteranceCount is already incremented atomically via incrementAndGetUtteranceCount
        // So we only update audio duration here
        recording.addAudioDuration(audioDurationMs);
        recordingRepository.save(recording);
    }

    private void broadcastUtterance(String sessionId, SessionUtterance utterance, boolean autoInsert) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "new_utterance");
        payload.put("utterance", utterance);
        payload.put("autoInsert", autoInsert);

        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId + "/utterance",
            payload
        );

        logger.info("Broadcasted utterance #{} to session {}", utterance.getUtteranceIndex(), sessionId);
    }

    private void broadcastProcessingStatus(String sessionId, String status, int progress) {
        broadcastProcessingStatus(sessionId, status, progress, null);
    }

    private void broadcastProcessingStatus(String sessionId, String status, int progress, String error) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "processing");
        payload.put("status", status);
        payload.put("progress", progress);
        if (error != null) {
            payload.put("error", error);
        }

        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId + "/utterance-processing",
            payload
        );
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return null;
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
