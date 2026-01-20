package com.bookclub.backend.session.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * 사용자별 개인 토론 노트
 * 세션 종료 시 공용 노트(session_notes)에서 fork되어 생성됨
 */
@Document(collection = "user_session_notes")
@CompoundIndexes({
    @CompoundIndex(name = "session_user_idx", def = "{'sessionId': 1, 'userId': 1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
public class UserSessionNote {

    @Id
    private String id;

    private String sessionId;      // sessions._id (연결된 세션)

    private String userId;         // users._id (노트 소유자)

    private String baseNoteId;     // session_notes._id (원본 공용 노트)

    private int baseVersion;       // 포크 당시 session_notes.version

    private String title;          // 노트 제목 (기본: 책 제목 + " 토론 노트")

    private String content;        // TipTap JSON 형식 콘텐츠

    private int version;           // 개인 노트 버전 (수정 시 증가)

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /**
     * 공용 노트에서 fork하여 개인 노트 생성
     */
    public static UserSessionNote forkFrom(SessionNote baseNote, String userId, String title) {
        UserSessionNote userNote = new UserSessionNote();
        userNote.setSessionId(baseNote.getSessionId());
        userNote.setUserId(userId);
        userNote.setBaseNoteId(baseNote.getId());
        userNote.setBaseVersion(baseNote.getVersion());
        userNote.setTitle(title);
        userNote.setContent(baseNote.getContent());
        userNote.setVersion(1);
        userNote.setCreatedAt(LocalDateTime.now());
        userNote.setUpdatedAt(LocalDateTime.now());
        return userNote;
    }

    /**
     * 노트 내용 업데이트
     */
    public void updateContent(String newContent) {
        this.content = newContent;
        this.version++;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 노트 제목 업데이트
     */
    public void updateTitle(String newTitle) {
        this.title = newTitle;
        this.updatedAt = LocalDateTime.now();
    }
}
