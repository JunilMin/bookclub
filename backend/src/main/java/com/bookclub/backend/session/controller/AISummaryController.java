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

            // Get notes content from block-based structure
            Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);
            String noteContent = noteOpt.map(SessionNote::getContentFromBlocks).orElse("");

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

            // Get notes content from block-based structure
            Optional<SessionNote> noteOpt = sessionNoteService.getNoteBySessionId(sessionId);
            String noteContent = noteOpt.map(SessionNote::getContentFromBlocks).orElse("");

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
     * Convert markdown-formatted text to TipTap JSON format
     * Supports: ## headings, ### subheadings, **bold**, _italic_, > blockquotes, - lists, --- dividers
     */
    private String convertToTipTapJson(String text, String language) {
        if (text == null || text.trim().isEmpty()) {
            return getEmptyTipTapDoc(language);
        }

        // Remove fragment markers if any remain
        text = text.replaceAll("⟦note_\\d{3}⟧\\s*", "");

        StringBuilder json = new StringBuilder();
        json.append("{\"type\":\"doc\",\"content\":[");

        // Split by lines
        String[] lines = text.split("\n");
        boolean firstContent = true;
        boolean inList = false;
        StringBuilder listItems = new StringBuilder();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // Check if we need to close a list
            if (inList && !trimmed.startsWith("- ") && !trimmed.matches("^\\d+\\.\\s.*")) {
                // Close the list
                if (!firstContent) json.append(",");
                json.append("{\"type\":\"bulletList\",\"content\":[").append(listItems).append("]}");
                listItems = new StringBuilder();
                inList = false;
                firstContent = false;
            }

            // Handle horizontal rule
            if (trimmed.equals("---") || trimmed.equals("***") || trimmed.equals("___")) {
                if (!firstContent) json.append(",");
                json.append("{\"type\":\"horizontalRule\"}");
                firstContent = false;
                continue;
            }

            // Handle headings
            if (trimmed.startsWith("## ")) {
                if (!firstContent) json.append(",");
                String headingText = trimmed.substring(3);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":2},\"content\":")
                    .append(convertInlineFormatting(headingText))
                    .append("}");
                firstContent = false;
                continue;
            }

            if (trimmed.startsWith("### ")) {
                if (!firstContent) json.append(",");
                String headingText = trimmed.substring(4);
                json.append("{\"type\":\"heading\",\"attrs\":{\"level\":3},\"content\":")
                    .append(convertInlineFormatting(headingText))
                    .append("}");
                firstContent = false;
                continue;
            }

            // Handle blockquote
            if (trimmed.startsWith("> ")) {
                if (!firstContent) json.append(",");
                String quoteText = trimmed.substring(2);
                json.append("{\"type\":\"blockquote\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(quoteText))
                    .append("}]}");
                firstContent = false;
                continue;
            }

            // Handle bullet list
            if (trimmed.startsWith("- ")) {
                String itemText = trimmed.substring(2);
                if (listItems.length() > 0) listItems.append(",");
                listItems.append("{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(itemText))
                    .append("}]}");
                inList = true;
                continue;
            }

            // Handle numbered list
            if (trimmed.matches("^\\d+\\.\\s.*")) {
                String itemText = trimmed.replaceFirst("^\\d+\\.\\s*", "");
                if (listItems.length() > 0) listItems.append(",");
                listItems.append("{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":")
                    .append(convertInlineFormatting(itemText))
                    .append("}]}");
                inList = true;
                continue;
            }

            // Regular paragraph
            if (!firstContent) json.append(",");
            json.append("{\"type\":\"paragraph\",\"content\":")
                .append(convertInlineFormatting(trimmed))
                .append("}");
            firstContent = false;
        }

        // Close any remaining list
        if (inList && listItems.length() > 0) {
            if (!firstContent) json.append(",");
            json.append("{\"type\":\"bulletList\",\"content\":[").append(listItems).append("]}");
        }

        json.append("]}");
        return json.toString();
    }

    /**
     * Convert inline markdown formatting (**bold**, _italic_) to TipTap marks
     */
    private String convertInlineFormatting(String text) {
        if (text == null || text.isEmpty()) {
            return "[]";
        }

        StringBuilder result = new StringBuilder("[");
        StringBuilder currentText = new StringBuilder();
        boolean inBold = false;
        boolean inItalic = false;
        boolean firstNode = true;
        int i = 0;

        while (i < text.length()) {
            // Check for **bold**
            if (i + 1 < text.length() && text.charAt(i) == '*' && text.charAt(i + 1) == '*') {
                // Flush current text
                if (currentText.length() > 0) {
                    if (!firstNode) result.append(",");
                    result.append(createTextNode(currentText.toString(), inBold, inItalic));
                    currentText = new StringBuilder();
                    firstNode = false;
                }
                inBold = !inBold;
                i += 2;
                continue;
            }

            // Check for _italic_ (but not in the middle of a word)
            if (text.charAt(i) == '_') {
                boolean isWordBoundary = (i == 0 || !Character.isLetterOrDigit(text.charAt(i - 1)))
                    || (i + 1 >= text.length() || !Character.isLetterOrDigit(text.charAt(i + 1)));
                if (isWordBoundary) {
                    // Flush current text
                    if (currentText.length() > 0) {
                        if (!firstNode) result.append(",");
                        result.append(createTextNode(currentText.toString(), inBold, inItalic));
                        currentText = new StringBuilder();
                        firstNode = false;
                    }
                    inItalic = !inItalic;
                    i++;
                    continue;
                }
            }

            currentText.append(text.charAt(i));
            i++;
        }

        // Flush remaining text
        if (currentText.length() > 0) {
            if (!firstNode) result.append(",");
            result.append(createTextNode(currentText.toString(), inBold, inItalic));
        }

        result.append("]");
        return result.toString();
    }

    /**
     * Create a TipTap text node with optional marks
     */
    private String createTextNode(String text, boolean bold, boolean italic) {
        StringBuilder node = new StringBuilder("{\"type\":\"text\",\"text\":\"");
        node.append(escapeJson(text));
        node.append("\"");

        if (bold || italic) {
            node.append(",\"marks\":[");
            boolean firstMark = true;
            if (bold) {
                node.append("{\"type\":\"bold\"}");
                firstMark = false;
            }
            if (italic) {
                if (!firstMark) node.append(",");
                node.append("{\"type\":\"italic\"}");
            }
            node.append("]");
        }

        node.append("}");
        return node.toString();
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

        // Convert TipTap JSON to Markdown (simplified) - use block-based structure
        String markdown = convertToMarkdown(bookTitle, note.getContentFromBlocks());

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
