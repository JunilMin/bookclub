package com.bookclub.backend.openai.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class OpenAiMessage {

    // 메세지 역할 (user, assistant, system)
    private String role;

    // 메세지 내용
    private String content;
}
