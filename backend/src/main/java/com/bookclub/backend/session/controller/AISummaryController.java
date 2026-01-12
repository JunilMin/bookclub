package com.bookclub.backend.session.controller;

import com.bookclub.backend.openai.OpenAIService;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.session.Session;
import com.bookclub.backend.session.SessionRepository;
import com.bookclub.backend.session.model.SessionNote;
import com.bookclub.backend.session.model.SessionRecording;
import com.bookclub.backend.session.model.SessionRecording.AISummary;
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
    public ResponseEntity<?> generateAISummary(@PathVariable String sessionId) {
        try {
            // Get session to find post
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            if (sessionOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Session session = sessionOpt.get();

            // Get post to find book title
            Optional<Post> postOpt = postRepository.findById(session.getPostId());
            String bookTitle = postOpt.map(Post::getBook).orElse("Unknown Book");

            // Get notes content
            Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);
            String noteContent = noteOpt.map(SessionNote::getContent).orElse("");

            // Generate summary
            AISummary summary = openAIService.generateSummary(bookTitle, noteContent);

            // Save to recording
            SessionRecording recording = sessionRecordingService.setAISummary(sessionId, summary);

            return ResponseEntity.ok(recording);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to generate AI summary: " + e.getMessage()));
        }
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
            bookTitle = postOpt.map(Post::getBook).orElse("Discussion Notes");
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
