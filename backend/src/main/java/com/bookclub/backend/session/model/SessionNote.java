package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "session_notes")
@Getter
@Setter
@NoArgsConstructor
public class SessionNote {
    @Id
    private String id;

    private String sessionId;

    private String title;  // Note title (default: "{bookTitle} 북클럽" or "{bookTitle} Book Club")

    private String content;  // TipTap JSON content (Free Notes)

    private String aiContent;  // TipTap JSON content (AI Organized Notes)

    private LocalDateTime aiContentGeneratedAt;  // When AI content was generated

    private int version;  // For conflict resolution

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String lastEditedById;  // User ObjectId of last editor

    public SessionNote(String sessionId) {
        this.sessionId = sessionId;
        this.title = "Discussion Notes";  // Default title (will be updated with book name)
        this.content = getDefaultContent();
        this.version = 1;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public SessionNote(String sessionId, String title) {
        this.sessionId = sessionId;
        this.title = title;  // Use provided title (e.g., "[2026-01-13] Clean Code")
        this.content = getDefaultContent();
        this.version = 1;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    private String getDefaultContent() {
        return """
            {
                "type": "doc",
                "content": [
                    {
                        "type": "heading",
                        "attrs": { "level": 1 },
                        "content": [{ "type": "text", "text": "Discussion Notes" }]
                    },
                    {
                        "type": "heading",
                        "attrs": { "level": 2 },
                        "content": [{ "type": "text", "text": "Main Topics" }]
                    },
                    {
                        "type": "bulletList",
                        "content": [
                            {
                                "type": "listItem",
                                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Add your discussion points here..." }] }]
                            }
                        ]
                    },
                    {
                        "type": "heading",
                        "attrs": { "level": 2 },
                        "content": [{ "type": "text", "text": "Key Quotes" }]
                    },
                    {
                        "type": "blockquote",
                        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Add memorable quotes here..." }] }]
                    },
                    {
                        "type": "heading",
                        "attrs": { "level": 2 },
                        "content": [{ "type": "text", "text": "Open Questions" }]
                    },
                    {
                        "type": "taskList",
                        "content": [
                            {
                                "type": "taskItem",
                                "attrs": { "checked": false },
                                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Questions to explore..." }] }]
                            }
                        ]
                    }
                ]
            }
            """;
    }
}
