package com.bookclub.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class EmailServiceTest {

    @Autowired
    private EmailService emailService;

    @Test
    public void testEmail() {
        // 테스트 이메일 주소 및 메시지 설정
        emailService.sendEmail("minccc@naver.com", "테스트 이메일", "이메일 발송이 성공했습니다.");
    }
}
