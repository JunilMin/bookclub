package com.bookclub.backend.calendar;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

import org.springframework.stereotype.Service;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.EntryPoint;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.Events;
import com.google.api.client.util.DateTime;

@Service
public class GoogleCalendarService {

    private static final String APPLICATION_NAME = "bookclub";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance(); // GsonFactory 사용
    private Calendar service;

    public GoogleCalendarService() throws GeneralSecurityException, IOException {
        this.service = getCalendarService();
    }

    private Calendar getCalendarService() throws GeneralSecurityException, IOException {
    // GoogleNetHttpTransport 초기화
    var httpTransport = GoogleNetHttpTransport.newTrustedTransport();

    // GoogleCredentialProvider를 통해 Credential 가져오기
    Credential credentials = null;
    try {
        credentials = GoogleCredentialProvider.getCredentials(httpTransport, JSON_FACTORY);
    } catch (Exception e) {
        e.printStackTrace();
        throw new IOException("Failed to load credentials: " + e.getMessage());
    }

    // Calendar 클라이언트 초기화
    return new Calendar.Builder(httpTransport, JSON_FACTORY, credentials)
            .setApplicationName(APPLICATION_NAME)
            .build();
}


    // Google Calendar API를 사용하여 이벤트 가져오기
    public List<Event> getUpcomingEvents(String calendarId) throws IOException {
        Events events = service.events()
                .list(calendarId)
                .setMaxResults(10) // 최대 10개의 이벤트만 가져오기
                .setOrderBy("startTime") // 시작 시간 기준으로 정렬
                .setSingleEvents(true) // 반복 이벤트를 단일 이벤트로 분리
                .execute();
        return events.getItems();
    }

    /**
     * Google Meet 링크가 포함된 이벤트 생성
     *
     * @param calendarId 캘린더 ID (예: "primary")
     * @return 생성된 이벤트 객체
     * @throws IOException
     */
    public Event createEventWithGoogleMeet(String calendarId) throws IOException {
        Event event = new Event()
        .setSummary("Google Meet Meeting")
        .setDescription("A meeting with Google Meet link")
        .setStart(new EventDateTime()
                .setDateTime(new DateTime("2024-01-01T10:00:00-07:00"))
                .setTimeZone("America/Los_Angeles"))
        .setEnd(new EventDateTime()
                .setDateTime(new DateTime("2024-01-01T11:00:00-07:00"))
                .setTimeZone("America/Los_Angeles"));
        // Google Meet 링크 추가를 위한 ConferenceData 설정
        ConferenceData conferenceData = new ConferenceData()
                .setCreateRequest(new CreateConferenceRequest()
                        .setRequestId("unique-request-id")); // 고유한 요청 ID 필요

        event.setConferenceData(conferenceData);

        // Google Calendar API로 이벤트 생성
        Event createdEvent = service.events()
                .insert(calendarId, event)
                .setConferenceDataVersion(1) // 반드시 설정
                .execute();

        System.out.printf("Event created: %s\n", createdEvent.getHtmlLink());

        // Google Meet 링크 출력
        if (createdEvent.getConferenceData() != null && createdEvent.getConferenceData().getEntryPoints() != null) {
            for (EntryPoint entryPoint : createdEvent.getConferenceData().getEntryPoints()) {
                if ("video".equals(entryPoint.getEntryPointType())) {
                    System.out.printf("Google Meet Link: %s\n", entryPoint.getUri());
                }
            }
        }

        return createdEvent;
    }
}
