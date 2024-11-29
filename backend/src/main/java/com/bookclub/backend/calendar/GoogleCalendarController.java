package com.bookclub.backend.calendar;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.google.api.services.calendar.model.Event;

@RestController
@RequestMapping("/api/calendar")
public class GoogleCalendarController {

    @Autowired
    private GoogleCalendarService googleCalendarService;

    @GetMapping("/events")
    public List<Event> getEvents(@RequestParam String calendarId) throws IOException {
        return googleCalendarService.getUpcomingEvents(calendarId);
    }

    /**
     * Google Meet 이벤트 생성 API
     *
     * @param calendarId 캘린더 ID
     * @return 생성된 이벤트 정보
     */
    @PostMapping("/events/meet")
    public Event createGoogleMeetEvent(@RequestParam String calendarId) {
        try {
            return googleCalendarService.createEventWithGoogleMeet(calendarId);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create Google Meet event: " + e.getMessage());
        }
    }
}
