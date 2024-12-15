package com.bookclub.backend.googleapi;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/meet")
public class MeetController {

    private final MeetService meetService;

    public MeetController(MeetService meetService) {
        this.meetService = meetService;
    }

    @GetMapping("/create")
    public String createMeetSpace() {
        try {
            return meetService.createSpace();
        } catch (Exception e) {
            e.printStackTrace();
            return "Error creating Google Meet space: " + e.getMessage();
        }
    }

    @GetMapping("/callback")
    public ResponseEntity<String> handleOAuthCallback(@RequestParam("code") String code) {
        System.out.println("Authorization code received: " + code);
        return ResponseEntity.ok("Authorization successful. Code: " + code);
    }
}
