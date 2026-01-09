package com.bookclub.backend.googleapi;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.CalendarScopes;
import com.google.api.services.calendar.model.*;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.GeneralSecurityException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.UUID;

/**
 * Google Calendar API를 사용하여 Google Meet 링크를 생성하는 서비스
 * 1) 서비스 계정 방식 (기본) - google-credentials.json 사용
 * 2) 사용자 OAuth2 방식 (선택) - accessToken 파라미터 제공 시
 */
@Service
public class GoogleCalendarService {

    private static final Logger logger = LoggerFactory.getLogger(GoogleCalendarService.class);
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String APPLICATION_NAME = "BookClub";
    private static final String CREDENTIALS_FILE_PATH = "google-credentials.json";

    private NetHttpTransport httpTransport;
    private GoogleCredentials serviceAccountCredentials;
    private boolean initialized = false;

    @PostConstruct
    public void init() {
        try {
            httpTransport = GoogleNetHttpTransport.newTrustedTransport();

            // 서비스 계정 인증 정보 로드
            try {
                ClassPathResource resource = new ClassPathResource(CREDENTIALS_FILE_PATH);
                try (InputStream in = resource.getInputStream()) {
                    serviceAccountCredentials = GoogleCredentials.fromStream(in)
                        .createScoped(Collections.singletonList(CalendarScopes.CALENDAR));
                    logger.info("Google Calendar Service initialized with Service Account");
                }
            } catch (IOException e) {
                logger.warn("Service account credentials not found. Only OAuth2 mode available.");
                serviceAccountCredentials = null;
            }

            initialized = true;
            logger.info("Google Calendar Service initialized successfully");
        } catch (IOException | GeneralSecurityException e) {
            logger.error("Failed to initialize Google Calendar Service: {}", e.getMessage());
        }
    }

    /**
     * 사용자의 Access Token으로 Calendar 서비스 생성
     */
    private Calendar createCalendarService(String accessToken) {
        GoogleCredentials credentials = GoogleCredentials.create(
            new com.google.auth.oauth2.AccessToken(accessToken, null)
        );
        HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

        return new Calendar.Builder(httpTransport, JSON_FACTORY, requestInitializer)
            .setApplicationName(APPLICATION_NAME)
            .build();
    }

    /**
     * 서비스 계정으로 Calendar 서비스 생성
     */
    private Calendar createCalendarServiceWithServiceAccount() throws IOException {
        if (serviceAccountCredentials == null) {
            throw new IOException("Service account credentials not available");
        }

        serviceAccountCredentials.refreshIfExpired();
        HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(serviceAccountCredentials);

        return new Calendar.Builder(httpTransport, JSON_FACTORY, requestInitializer)
            .setApplicationName(APPLICATION_NAME)
            .build();
    }

    /**
     * Google Meet 링크가 포함된 캘린더 이벤트를 생성합니다.
     * 사용자 OAuth 토큰이 없으면 서비스 계정을 사용합니다.
     *
     * @param title       이벤트 제목 (책 이름)
     * @param startTime   시작 시간
     * @param endTime     종료 시간 (null이면 시작 시간 + 1시간)
     * @param accessToken 사용자의 Google OAuth2 Access Token (Calendar scope 필요, null이면 서비스 계정 사용)
     * @return MeetEventResult 생성된 Meet 링크와 이벤트 ID
     */
    public MeetEventResult createMeetEvent(String title, LocalDateTime startTime, LocalDateTime endTime, String accessToken) {
        if (!initialized) {
            logger.warn("Google Calendar Service not initialized. Skipping Meet link generation.");
            return new MeetEventResult(null, null, "Google Calendar Service not initialized");
        }

        try {
            Calendar calendarService;

            // 사용자 토큰이 있으면 사용자 OAuth 사용, 없으면 서비스 계정 사용
            if (accessToken != null && !accessToken.isEmpty()) {
                logger.info("Creating Meet event with user OAuth token");
                calendarService = createCalendarService(accessToken);
            } else if (serviceAccountCredentials != null) {
                logger.info("Creating Meet event with service account (fallback)");
                calendarService = createCalendarServiceWithServiceAccount();
            } else {
                logger.warn("No access token and no service account available. Skipping Meet link generation.");
                return new MeetEventResult(null, null, "No credentials available for Calendar API");
            }

            // 종료 시간이 없으면 시작 시간 + 1시간
            if (endTime == null) {
                endTime = startTime.plusHours(1);
            }

            // 이벤트 생성
            Event event = new Event()
                .setSummary("[BookClub] " + title)
                .setDescription("BookClub 독서 토론 모임: " + title);

            // 시작/종료 시간 설정
            DateTime startDateTime = new DateTime(
                java.util.Date.from(startTime.atZone(ZoneId.systemDefault()).toInstant())
            );
            DateTime endDateTime = new DateTime(
                java.util.Date.from(endTime.atZone(ZoneId.systemDefault()).toInstant())
            );

            event.setStart(new EventDateTime().setDateTime(startDateTime).setTimeZone("Asia/Seoul"));
            event.setEnd(new EventDateTime().setDateTime(endDateTime).setTimeZone("Asia/Seoul"));

            // Google Meet 회의 데이터 설정
            ConferenceData conferenceData = new ConferenceData();
            CreateConferenceRequest createConferenceRequest = new CreateConferenceRequest();

            // UUID를 사용하여 중복 방지 requestId 생성
            String requestId = UUID.randomUUID().toString();
            createConferenceRequest.setRequestId(requestId);

            ConferenceSolutionKey conferenceSolutionKey = new ConferenceSolutionKey();
            conferenceSolutionKey.setType("hangoutsMeet");
            createConferenceRequest.setConferenceSolutionKey(conferenceSolutionKey);

            conferenceData.setCreateRequest(createConferenceRequest);
            event.setConferenceData(conferenceData);

            // 이벤트 생성 API 호출 (conferenceDataVersion=1 필수)
            Event createdEvent = calendarService.events()
                .insert("primary", event)
                .setConferenceDataVersion(1)
                .execute();

            // 결과 추출
            String meetLink = null;
            if (createdEvent.getConferenceData() != null &&
                createdEvent.getConferenceData().getEntryPoints() != null) {
                for (EntryPoint entryPoint : createdEvent.getConferenceData().getEntryPoints()) {
                    if ("video".equals(entryPoint.getEntryPointType())) {
                        meetLink = entryPoint.getUri();
                        break;
                    }
                }
            }

            // hangoutLink 폴백
            if (meetLink == null) {
                meetLink = createdEvent.getHangoutLink();
            }

            String eventId = createdEvent.getId();
            logger.info("Google Meet event created successfully. EventId: {}, MeetLink: {}", eventId, meetLink);

            return new MeetEventResult(meetLink, eventId, null);

        } catch (IOException e) {
            logger.error("Failed to create Google Meet event: {}", e.getMessage());
            return new MeetEventResult(null, null, e.getMessage());
        }
    }

    /**
     * 캘린더 이벤트를 삭제합니다. (v2.1 예정)
     * @param eventId 삭제할 이벤트 ID
     * @param accessToken 사용자의 Google OAuth Access Token
     */
    public boolean deleteEvent(String eventId, String accessToken) {
        if (!initialized || eventId == null || accessToken == null) {
            return false;
        }

        try {
            Calendar calendarService = createCalendarService(accessToken);
            calendarService.events().delete("primary", eventId).execute();
            logger.info("Calendar event deleted: {}", eventId);
            return true;
        } catch (IOException e) {
            logger.error("Failed to delete calendar event: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 서비스 초기화 상태 확인
     */
    public boolean isInitialized() {
        return initialized;
    }

    /**
     * Meet 이벤트 생성 결과를 담는 클래스
     */
    public static class MeetEventResult {
        private final String meetLink;
        private final String eventId;
        private final String error;

        public MeetEventResult(String meetLink, String eventId, String error) {
            this.meetLink = meetLink;
            this.eventId = eventId;
            this.error = error;
        }

        public String getMeetLink() {
            return meetLink;
        }

        public String getEventId() {
            return eventId;
        }

        public String getError() {
            return error;
        }

        public boolean isSuccess() {
            return meetLink != null && error == null;
        }
    }
}
