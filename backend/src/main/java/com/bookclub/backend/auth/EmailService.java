// ./auth/EmailService.java
package com.bookclub.backend.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendEmail(String to, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }

    // 인증 이메일 발송 메서드
    public void sendVerificationEmail(String to, String verificationToken) {
        String subject = "Please verify your email address";
        String verificationUrl = "http://localhost:8080/api/auth/verify-email?token=" + verificationToken;
        String text = "Please click the link below to verify your email address:\n" + verificationUrl;
        sendEmail(to, subject, text);
    }
}
