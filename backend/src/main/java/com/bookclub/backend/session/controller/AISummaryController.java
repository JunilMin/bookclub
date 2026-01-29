package com.bookclub.backend.session.controller;

import com.bookclub.backend.openai.OpenAIService;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
import com.bookclub.backend.session.model.SessionRecording.AIOrganizedContent;
import com.bookclub.backend.session.service.SessionNoteService;
import com.bookclub.backend.session.service.SessionRecordingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "http://localhost:5173")
public class AISummaryController {

    @Autowired
    private OpenAIService openAIService;

    @Autowired
    private SessionNoteService sessionNoteService;

    @Autowired
    private SessionRecordingService sessionRecordingService;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PostRepository postRepository;

    /**
     * Get recording status and AI summary
     */
    @GetMapping("/{sessionId}/recording")
    public ResponseEntity<SessionRecording> getRecording(@PathVariable String sessionId) {
        SessionRecording recording = sessionRecordingService.getOrCreateRecording(sessionId);
        return ResponseEntity.ok(recording);
    }

    /**
     * Toggle recording status
     */
    @PostMapping("/{sessionId}/recording/toggle")
    public ResponseEntity<SessionRecording> toggleRecording(@PathVariable String sessionId) {
        SessionRecording recording = sessionRecordingService.toggleRecording(sessionId);
        return ResponseEntity.ok(recording);
    }

    /**
     * Generate AI summary from notes
     */
    @PostMapping("/{sessionId}/ai-summary")
    public ResponseEntity<?> generateAISummary(
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "en") String language) {
        try {
            // Get session to find post
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            if (sessionOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Session session = sessionOpt.get();

            // Get post to find book title
            Optional<Post> postOpt = postRepository.findById(session.getPostId());
            String bookTitle = postOpt
                    .map(p -> p.getBookData() != null ? p.getBookData().getTitle() : null)
                    .orElse("Unknown Book");

            // Get notes content
            Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);
            String noteContent = noteOpt.map(SessionNote::getContent).orElse("");

            // Generate summary with specified language
            AISummary summary = openAIService.generateSummary(bookTitle, noteContent, language);

            // Save to recording
            SessionRecording recording = sessionRecordingService.setAISummary(sessionId, summary);

            return ResponseEntity.ok(recording);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to generate AI summary: " + e.getMessage()));
        }
    }

    /**
     * Organize notes using AI Context-Preserving Editor
     * Reorganizes content for readability while preserving ALL original content
     * Saves the result to SessionNote.aiContent as TipTap JSON
     */
    @PostMapping("/{sessionId}/ai-organize")
    public ResponseEntity<?> organizeNotes(
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "en") String language) {
        try {
            // Get session to find post
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            if (sessionOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Session session = sessionOpt.get();

            // Get post to find book title
            Optional<Post> postOpt = postRepository.findById(session.getPostId());
            String bookTitle = postOpt
                    .map(p -> p.getBookData() != null ? p.getBookData().getTitle() : null)
                    .orElse("Unknown Book");

            // Get notes content
            Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);
            String noteContent = noteOpt.map(SessionNote::getContent).orElse("");

            // Organize notes with AI
            AIOrganizedContent organizedContent = openAIService.organizeNotes(bookTitle, noteContent, language);

            // Convert organized text to TipTap JSON format
            String aiContentJson = convertToTipTapJson(organizedContent.getOrganizedText(), language);

            // Save to SessionNote.aiContent
            SessionNote updatedNote = sessionNoteService.updateAiContent(sessionId, aiContentJson);

            // Return both the note and the validation info
            return ResponseEntity.ok(Map.of(
                "note", updatedNote,
                "validation", Map.of(
                    "valid", organizedContent.isValid(),
                    "sourceFragmentIds", organizedContent.getSourceFragmentIds(),
                    "outputFragmentIds", organizedContent.getOutputFragmentIds(),
                    "missingFragments", organizedContent.getMissingFragments(),
                    "validationError", organizedContent.getValidationError() != null ? organizedContent.getValidationError() : ""
                )
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to organize notes: " + e.getMessage()));
        }
    }

    /**
     * Convert plain text (with optional markdown headers) to TipTap JSON format
     */
    private String convertToTipTapJson(String text, String language) {
        if (text == null || text.trim().isEmpty()) {
            return getEmptyTipTapDoc(language);
        }

        StringBuilder json = new StringBuilder();
        json.append("{\"type\":\"doc\",\"content\":[");

        // Add heading
        String heading = "ko".equalsIgnoreCase(language) ? "AI 정리된 노트" : "AI Organized Notes";
        json.append("{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"")
            .append(escapeJson(heading))
            .append("\"}]},");

        // Split by lines and convert each to paragraph or heading
        String[] lines = text.split("\n");
        boolean firstContent = true;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            if (!firstContent) {
                json.append(",");
            }
            firstContent = false;

            if (trimmed.startsWith("## ")) {
                // H2 heading
                String headingText = trimmed.substring(3);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":[{\"type\":\"text\",\"text\":\"")
                    .append(escapeJson(headingText))
                    .append("\"}]}");
            } else if (trimmed.startsWith("### ")) {
                // H3 heading
                String headingText = trimmed.substring(4);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":3},\"content\":[{\"type\":\"text\",\"text\":\"")
                    .append(escapeJson(headingText))
                    .append("\"}]}");
            } else {
                // Regular paragraph
                json.append("{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"")
                    .append(escapeJson(trimmed))
                    .append("\"}]}");
            }
        }

        json.append("]}");
        return json.toString();
    }

    private String getEmptyTipTapDoc(String language) {
        String heading = "ko".equalsIgnoreCase(language) ? "AI 정리된 노트" : "AI Organized Notes";
        String placeholder = "ko".equalsIgnoreCase(language) ? "AI 정리된 내용이 여기에 표시됩니다." : "AI organized content will appear here.";
        return String.format(
            "{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"%s\"}]},{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"%s\"}]}]}",
            heading, placeholder
        );
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    /**
     * Export notes as markdown
     */
    @GetMapping("/{sessionId}/export/markdown")
    public ResponseEntity<String> exportMarkdown(@PathVariable String sessionId) {
        Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);

        if (noteOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SessionNote note = noteOpt.get();

        // Get session info
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        String bookTitle = "Discussion Notes";

        if (sessionOpt.isPresent()) {
            Optional<Post> postOpt = postRepository.findById(sessionOpt.get().getPostId());
            bookTitle = postOpt
                    .map(p -> p.getBookData() != null ? p.getBookData().getTitle() : null)
                    .orElse("Discussion Notes");
        }

        // Convert TipTap JSON to Markdown (simplified)
        String markdown = convertToMarkdown(bookTitle, note.getContent());

        return ResponseEntity.ok()
                .header("Content-Type", "text/markdown")
                .header("Content-Disposition", "attachment; filename=\"notes.md\"")
                .body(markdown);
    }

    private String convertToMarkdown(String title, String jsonContent) {
        StringBuilder md = new StringBuilder();
        md.append("# ").append(title).append("\n\n");
        md.append("_Generated from BookClub Discussion_\n\n");
        md.append("---\n\n");

        // Simple conversion - in production use proper JSON parsing
        md.append(jsonContent.replaceAll("\\{|\\}|\\[|\\]|\"type\":|\"content\":|\"text\":", "")
                .replaceAll("\"heading\"", "\n## ")
                .replaceAll("\"paragraph\"", "\n")
                .replaceAll("\"bulletList\"", "\n")
                .replaceAll("\"listItem\"", "- ")
                .replaceAll("\"blockquote\"", "\n> ")
                .replaceAll("\"taskList\"", "\n")
                .replaceAll("\"taskItem\"", "- [ ] ")
                .replaceAll(",", " ")
                .replaceAll("\"", "")
                .trim());

        return md.toString();
    }
}
