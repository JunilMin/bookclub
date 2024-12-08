package com.bookclub.backend.googleapi;


import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;

@RestController
public class GoogleMeetController {

    private final GoogleMeetService googleMeetService;

    public GoogleMeetController() {
        this.googleMeetService = new GoogleMeetService();
    }

    @GetMapping("/create-meet")
    public String createGoogleMeet() {
        try {
            String meetLink = googleMeetService.createGoogleMeetEvent(
                    "Sample Event",
                    "This is a test event with Google Meet integration",
                    new Date(),
                    new Date(System.currentTimeMillis() + 3600000) // 1시간 뒤
            );
            return "Google Meet Link: " + meetLink;
        } catch (Exception e) {
            e.printStackTrace();
            return "Failed to create Google Meet: " + e.getMessage();
        }
    }
}
