package com.bookclub.backend.openai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class OpenAiRequest {

    // 사용할 모델명
    private String model;

    // 메세지 리스트
    private List<OpenAiMessage> messages;

    // 창의성 조절 (0 ~ 2)
    private Double temperature;

    // 응답 최대 길이 (토큰 단위)
    @JsonProperty("max_tokens")
    private Integer maxTokens;

    public OpenAiRequest(String model, List<OpenAiMessage> messages) {
        this.model = model;
        this.messages = messages;
        this.temperature = 0.7;
        this.maxTokens = 1000;
    }
}
