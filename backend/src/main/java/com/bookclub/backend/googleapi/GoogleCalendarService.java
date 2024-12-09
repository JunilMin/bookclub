package com.bookclub.backend.googleapi;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.Events;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Date;
import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarService {
    private static final String APPLICATION_NAME = "bookclub";
    private static final JsonFactory JSON_FACTORY = JacksonFactory.getDefaultInstance();

    public Calendar getCalendarService(String accessToken) throws GeneralSecurityException, IOException {
        var HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
        Credential credential = new Credential.Builder(
                com.google.api.client.auth.oauth2.BearerToken.authorizationHeaderAccessMethod())
                .setTransport(HTTP_TRANSPORT)
                .setJsonFactory(JSON_FACTORY)
                .build()
                .setAccessToken(accessToken);

        return new Calendar.Builder(HTTP_TRANSPORT, JSON_FACTORY, credential)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    public Event addEvent(String accessToken, String summary, Date startDate, Date endDate) throws IOException, GeneralSecurityException {
        Event event = new Event()
                .setSummary(summary)
                .setStart(new com.google.api.services.calendar.model.EventDateTime().setDateTime(new com.google.api.client.util.DateTime(startDate)))
                .setEnd(new com.google.api.services.calendar.model.EventDateTime().setDateTime(new com.google.api.client.util.DateTime(endDate)));

        return getCalendarService(accessToken).events().insert("primary", event).execute();
    }

    public void deleteEvent(String accessToken, String eventId) throws IOException, GeneralSecurityException {
        getCalendarService(accessToken).events().delete("primary", eventId).execute();
    }

    public Event updateEvent(String accessToken, String eventId, String summary, Date startDate, Date endDate) throws IOException, GeneralSecurityException {
        Event event = new Event()
                .setSummary(summary)
                .setStart(new com.google.api.services.calendar.model.EventDateTime().setDateTime(new com.google.api.client.util.DateTime(startDate)))
                .setEnd(new com.google.api.services.calendar.model.EventDateTime().setDateTime(new com.google.api.client.util.DateTime(endDate)));

        return getCalendarService(accessToken).events().update("primary", eventId, event).execute();
    }

    public List<Event> listEvents(String accessToken) throws IOException, GeneralSecurityException {
        Events events = getCalendarService(accessToken).events().list("primary")
                .setOrderBy("startTime")
                .setSingleEvents(true)
                .execute();
        return events.getItems();
    }


    public String createMeetEvent(String accessToken, String summary, Date startDate, Date endDate) throws IOException, GeneralSecurityException {
        Event event = new Event()
                .setSummary(summary)
                .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(startDate)))
                .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(endDate)))
                .setConferenceData(new ConferenceData().setCreateRequest(
                        new CreateConferenceRequest().setRequestId("random-uuid")));

        Event createdEvent = getCalendarService(accessToken).events()
                .insert("primary", event)
                .setConferenceDataVersion(1)
                .execute();

        return createdEvent.getConferenceData().getEntryPoints().get(0).getUri(); // Google Meet 링크 반환
    }
}
