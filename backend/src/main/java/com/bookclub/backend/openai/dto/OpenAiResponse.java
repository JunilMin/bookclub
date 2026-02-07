package com.bookclub.backend.openai.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class OpenAiResponse {

    // GPT가 생성한 응답 선택지 리스트
    private List<Choice> choices;

    @Getter
    @NoArgsConstructor
    public static class Choice {
        // 응답 메세지 객체
        private OpenAiMessage message;
    }

    /**
     * 첫 번째 응답의 content를 반환
     */
    public String getContent() {
        if (choices != null && !choices.isEmpty()) {
            OpenAiMessage message = choices.get(0).getMessage();
            if (message != null) {
                return message.getContent();
            }
        }
        return null;
    }
}
