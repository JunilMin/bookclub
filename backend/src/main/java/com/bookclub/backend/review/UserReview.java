package com.bookclub.backend.review;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "user_review")
@Getter
@Setter
@NoArgsConstructor
public class UserReview {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private Integer rating;          // 1~5 별점 (null if skipped)
    private String goodPoints;       // 좋았던 점
    private String badPoints;        // 아쉬운 점
    private Boolean consentToExpose; // 리뷰 공개 동의
    private LocalDateTime submittedAt; // 제출 시점 (non-null = 제출 완료, 다시 안 뜸)
    private LocalDateTime skippedAt;   // 건너뛰기 시점 (3일 후 재노출)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
