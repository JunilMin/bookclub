public import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.*;

import java.io.InputStreamReader;
import java.util.Collections;

public class GoogleMeetIntegration {

    private static final String APPLICATION_NAME = "Your Application Name";
    private static final JsonFactory JSON_FACTORY = JacksonFactory.getDefaultInstance();

    public static Credential getCredentials() throws Exception {
        // Load client secrets.
        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
            JSON_FACTORY, new InputStreamReader(GoogleMeetIntegration.class.getResourceAsStream("/credentials.json"))
        );

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            JSON_FACTORY,
            clientSecrets,
            Collections.singletonList("https://www.googleapis.com/auth/calendar.events")
        ).setAccessType("offline").build();

        LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
        return new Credential(flow.newTokenRequest(receiver.getAuthorizationCode()).execute());
    }

    public static Calendar getCalendarService() throws Exception {
        Credential credential = getCredentials();
        return new Calendar.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            JSON_FACTORY,
            credential
        ).setApplicationName(APPLICATION_NAME).build();
    }

    public static void createGoogleMeetEvent() throws Exception {
        Calendar service = getCalendarService();

        Event event = new Event()
            .setSummary("Google Meet Test Meeting")
            .setDescription("This is a test meeting created via Google Calendar API")
            .setStart(new EventDateTime().setDateTime("2024-11-30T10:00:00-07:00"))
            .setEnd(new EventDateTime().setDateTime("2024-11-30T11:00:00-07:00"))
            .setConferenceData(new ConferenceData().setCreateRequest(
                new CreateConferenceRequest()
                    .setRequestId("sample123")
                    .setConferenceSolutionKey(
                        new ConferenceSolutionKey().setType("hangoutsMeet"))
            ));

        String calendarId = "primary"; // 주 캘린더
        service.events().insert(calendarId, event)
            .setConferenceDataVersion(1)
            .execute();
    }
}
 {
    
}
