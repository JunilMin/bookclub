package com.bookclub.backend.googleapi;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.ConferenceSolutionKey;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;

import java.io.InputStreamReader;
import java.util.Collections;
import java.util.Date;

public class GoogleMeetService {

    private static final String APPLICATION_NAME = "Google Meet Integration";
    private static final JsonFactory JSON_FACTORY = JacksonFactory.getDefaultInstance();
    private static final String TOKENS_DIRECTORY_PATH = "tokens";

    private static final java.util.List<String> SCOPES = Collections.singletonList("https://www.googleapis.com/auth/calendar");

    private Calendar getCalendarService() throws Exception {
        HttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        Credential credentials = loadCredentials(httpTransport);
    
        return new Calendar.Builder(httpTransport, JSON_FACTORY, credentials)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }
    

   private Credential loadCredentials(HttpTransport httpTransport) throws Exception {
    var in = GoogleMeetService.class.getResourceAsStream("/credentials.json");
    if (in == null) {
        throw new Exception("Resource not found: credentials.json");
    }
    var clientSecrets = GoogleClientSecrets.load(JSON_FACTORY, new InputStreamReader(in));

    var flow = new GoogleAuthorizationCodeFlow.Builder(
            httpTransport,
            JSON_FACTORY,
            clientSecrets,
            SCOPES
    ).setAccessType("offline").build();

    return new AuthorizationCodeInstalledApp(flow, new LocalServerReceiver()).authorize("user");
}


    public String createGoogleMeetEvent(String summary, String description, Date startDate, Date endDate) throws Exception {
        var service = getCalendarService();

        Event event = new Event()
                .setSummary(summary)
                .setDescription(description)
                .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(startDate)))
                .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(endDate)));

        // Google Meet Conference 설정
        ConferenceData conferenceData = new ConferenceData();
        conferenceData.setCreateRequest(
                new CreateConferenceRequest()
                        .setRequestId("unique-request-id")
                        .setConferenceSolutionKey(
                                new ConferenceSolutionKey().setType("hangoutsMeet")
                        )
        );
        event.setConferenceData(conferenceData);

        // Google Calendar에 이벤트 생성
        event = service.events().insert("primary", event)
                .setConferenceDataVersion(1)
                .execute();

        return event.getHangoutLink();
    }
}
