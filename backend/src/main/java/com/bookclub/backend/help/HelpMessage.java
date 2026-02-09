package com.bookclub.backend.help;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "help_msgs")
@Getter
@Setter
@NoArgsConstructor
public class HelpMessage {

    @Id
    private String id;

    private boolean loggedIn;
    private String email;
    private String contents;

    // 로그인 사용자 전용
    private String userId;
    private String username;

    private LocalDateTime createdAt;

    /** 비로그인 문의 */
    public HelpMessage(String email, String contents) {
        this.loggedIn = false;
        this.email = email;
        this.contents = contents;
        this.createdAt = LocalDateTime.now();
    }

    /** 로그인 문의 */
    public HelpMessage(String email, String contents, String userId, String username) {
        this.loggedIn = true;
        this.email = email;
        this.contents = contents;
        this.userId = userId;
        this.username = username;
        this.createdAt = LocalDateTime.now();
    }
}
