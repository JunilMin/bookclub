package com.bookclub.backend.session.controller;

import com.bookclub.backend.session.model.SessionUtterance;
import com.bookclub.backend.session.service.UtteranceService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for utterance management.
 * Handles audio upload, utterance listing, and settings.
 */
@RestController
@RequestMapping("/api/sessions/{sessionId}/utterances")
@RequiredArgsConstructor
public class UtteranceController {

    private static final Logger logger = LoggerFactory.getLogger(UtteranceController.class);
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_DATE_TIME;

    private final UtteranceService utteranceService;

    /**
     * Upload audio and start processing.
     * Returns 202 Accepted immediately; result is broadcast via WebSocket.
     *
     * @param sessionId       Session ID
     * @param audio           Audio file (WebM, MP3, WAV, etc.)
     * @param speakerId       Speaker's user ID
     * @param speakerName     Speaker's username
     * @param speakerPhotoUrl Speaker's photo URL (optional)
     * @param startAt         Utterance start time (ISO format)
     * @param endAt           Utterance end time (ISO format)
     * @param language        Language hint ("auto", "ko", "en")
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadUtterance(
            @PathVariable String sessionId,
            @RequestParam("audio") MultipartFile audio,
            @RequestParam("speakerId") String speakerId,
            @RequestParam("speakerName") String speakerName,
            @RequestParam(value = "speakerPhotoUrl", required = false, defaultValue = "") String speakerPhotoUrl,
            @RequestParam("startAt") String startAt,
            @RequestParam("endAt") String endAt,
            @RequestParam(value = "language", defaultValue = "auto") String language) {

        logger.info("=== Utterance Upload Request ===");
        logger.info("Session: {}", sessionId);
        logger.info("Speaker: {} ({})", speakerName, speakerId);
        logger.info("Audio: {} bytes, type: {}", audio.getSize(), audio.getContentType());
        logger.info("Time: {} to {}", startAt, endAt);
        logger.info("Language: {}", language);

        try {
            // Parse timestamps
            LocalDateTime startTime = LocalDateTime.parse(startAt, ISO_FORMATTER);
            LocalDateTime endTime = LocalDateTime.parse(endAt, ISO_FORMATTER);

            // Get filename with extension
            String filename = audio.getOriginalFilename();
            if (filename == null || filename.isEmpty()) {
                filename = "utterance.webm";
            }

            // Start async processing
            utteranceService.processUtterance(
                sessionId,
                speakerId,
                speakerName,
                speakerPhotoUrl,
                audio.getBytes(),
                filename,
                startTime,
                endTime,
                language
            );

            // Return accepted response
            Map<String, Object> response = new HashMap<>();
            response.put("status", "accepted");
            response.put("message", "Utterance processing started. Results will be broadcast via WebSocket.");

            return ResponseEntity.accepted().body(response);

        } catch (Exception e) {
            logger.error("Error uploading utterance: {}", e.getMessage(), e);

            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Failed to process utterance: " + e.getMessage());

            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * Get all utterances for a session.
     */
    @GetMapping
    public ResponseEntity<List<SessionUtterance>> getUtterances(@PathVariable String sessionId) {
        logger.info("Getting utterances for session: {}", sessionId);

        List<SessionUtterance> utterances = utteranceService.getUtterances(sessionId);
        return ResponseEntity.ok(utterances);
    }

    /**
     * Get a specific utterance by index.
     */
    @GetMapping("/{utteranceIndex}")
    public ResponseEntity<SessionUtterance> getUtterance(
            @PathVariable String sessionId,
            @PathVariable int utteranceIndex) {

        logger.info("Getting utterance {}/{}", sessionId, utteranceIndex);

        Optional<SessionUtterance> utterance = utteranceService.getUtterance(sessionId, utteranceIndex);
        return utterance.map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Mark an utterance as inserted to notes.
     */
    @PostMapping("/{utteranceIndex}/insert-to-notes")
    public ResponseEntity<SessionUtterance> markInsertedToNotes(
            @PathVariable String sessionId,
            @PathVariable int utteranceIndex) {

        logger.info("Marking utterance {}/{} as inserted to notes", sessionId, utteranceIndex);

        try {
            SessionUtterance updated = utteranceService.markAsInsertedToNotes(sessionId, utteranceIndex);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            logger.error("Error marking utterance as inserted: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Update auto-insert setting.
     */
    @PutMapping("/settings/auto-insert")
    public ResponseEntity<Map<String, Object>> setAutoInsert(
            @PathVariable String sessionId,
            @RequestParam boolean enabled) {

        logger.info("Setting auto-insert for session {}: {}", sessionId, enabled);

        utteranceService.setAutoInsertToNotes(sessionId, enabled);

        Map<String, Object> response = new HashMap<>();
        response.put("autoInsertToNotes", enabled);
        response.put("message", "Auto-insert setting updated");

        return ResponseEntity.ok(response);
    }

    /**
     * Get auto-insert setting.
     */
    @GetMapping("/settings/auto-insert")
    public ResponseEntity<Map<String, Object>> getAutoInsert(@PathVariable String sessionId) {
        boolean enabled = utteranceService.isAutoInsertEnabled(sessionId);

        Map<String, Object> response = new HashMap<>();
        response.put("autoInsertToNotes", enabled);

        return ResponseEntity.ok(response);
    }

    /**
     * Update language policy.
     */
    @PutMapping("/settings/language")
    public ResponseEntity<Map<String, Object>> setLanguagePolicy(
            @PathVariable String sessionId,
            @RequestParam String language) {

        logger.info("Setting language policy for session {}: {}", sessionId, language);

        if (!language.equalsIgnoreCase("auto") &&
            !language.equalsIgnoreCase("ko") &&
            !language.equalsIgnoreCase("en")) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Invalid language. Use 'auto', 'ko', or 'en'.");
            return ResponseEntity.badRequest().body(error);
        }

        utteranceService.setLanguagePolicy(sessionId, language.toLowerCase());

        Map<String, Object> response = new HashMap<>();
        response.put("languagePolicy", language.toLowerCase());
        response.put("message", "Language policy updated");

        return ResponseEntity.ok(response);
    }
}
