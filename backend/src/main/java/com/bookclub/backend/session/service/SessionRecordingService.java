package com.bookclub.backend.session.service;

import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AIOrganizedContent;
import com.bookclub.backend.session.repository.SessionRecordingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class SessionRecordingService {

    @Autowired
    private SessionRecordingRepository sessionRecordingRepository;

    public SessionRecording getOrCreateRecording(String sessionId) {
        Optional<SessionRecording> recordingOpt = sessionRecordingRepository.findBySessionId(sessionId);
        if (recordingOpt.isPresent()) {
            return recordingOpt.get();
        }

        SessionRecording recording = new SessionRecording(sessionId);
        return sessionRecordingRepository.save(recording);
    }

    public SessionRecording toggleRecording(String sessionId) {
        SessionRecording recording = getOrCreateRecording(sessionId);

        if (recording.isRecording()) {
            recording.stopRecording();
        } else {
            recording.startRecording();
        }

        return sessionRecordingRepository.save(recording);
    }

    public SessionRecording setAISummary(String sessionId, AISummary summary) {
        SessionRecording recording = getOrCreateRecording(sessionId);
        recording.setAiSummary(summary);
        return sessionRecordingRepository.save(recording);
    }

    public SessionRecording setAIOrganizedContent(String sessionId, AIOrganizedContent organizedContent) {
        SessionRecording recording = getOrCreateRecording(sessionId);
        recording.setAiOrganizedContent(organizedContent);
        return sessionRecordingRepository.save(recording);
    }

    public Optional<SessionRecording> getRecordingBySessionId(String sessionId) {
        return sessionRecordingRepository.findBySessionId(sessionId);
    }
}
