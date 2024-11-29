package com.bookclub.backend.calendar;

import java.io.InputStreamReader;
import java.util.Collections;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;

public class GoogleCredentialProvider {

    private static final String CREDENTIALS_FILE_PATH = "credentials.json";

    @SuppressWarnings("unused")
        public static Credential getCredentials(HttpTransport httpTransport, JsonFactory jsonFactory) throws Exception {
        // 클래스패스에서 credentials.json 파일 읽기
                InputStreamReader reader = new InputStreamReader(
                GoogleCredentialProvider.class.getClassLoader().getResourceAsStream(CREDENTIALS_FILE_PATH));

                if (reader == null) {
                        throw new Exception("Cannot find credentials.json in classpath.");
                }

                GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(jsonFactory, reader);

        // Google Authorization Code Flow 초기화
                GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                        httpTransport, jsonFactory, clientSecrets, Collections.singletonList("https://www.googleapis.com/auth/calendar"))
                        .setAccessType("offline")
                        .build();

                        return flow.loadCredential("user");
    }
}
