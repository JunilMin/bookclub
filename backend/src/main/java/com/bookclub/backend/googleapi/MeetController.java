package com.bookclub.backend.googleapi;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeetController {

    private final MeetService meetService;
    
    public MeetController(MeetService meetService) {
        this.meetService = meetService;
    }

    @GetMapping("/api/meet/create")
    public String createMeetSpace() {
        try {
            return meetService.createSpace();
        } catch (Exception e) {
            e.printStackTrace();
            return "Error creating Google Meet space: " + e.getMessage();
        }
    }
}
