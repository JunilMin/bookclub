package com.bookclub.backend.auth;

import com.google.auth.oauth2.ClientId;
import com.google.auth.oauth2.DefaultPKCEProvider;
import com.google.auth.oauth2.UserAuthorizer;
import com.google.auth.oauth2.UserCredentials;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.util.Collections;
import java.util.List;

@Service
public class GoogleAuthService {

    private static final String CLIENT_SECRET_PATH = "/credentials.json"; // 클래스패스에서 읽음
    private static final String CALLBACK_URI = "http://localhost:8888/api/meet/callback";
    private static final List<String> SCOPES = Collections.singletonList("https://www.googleapis.com/auth/meetings");

    public String getAccessToken() throws Exception {
        // 클래스패스에서 credentials.json 로드
        InputStream credentialsStream = getClass().getResourceAsStream(CLIENT_SECRET_PATH);
        if (credentialsStream == null) {
            throw new IllegalArgumentException("credentials.json 파일을 찾을 수 없습니다: " + CLIENT_SECRET_PATH);
        }

        // Google OAuth Client ID 생성
        ClientId clientId = ClientId.fromStream(credentialsStream);

        // UserAuthorizer 생성
        UserAuthorizer authorizer = UserAuthorizer.newBuilder()
                .setClientId(clientId)
                .setCallbackUri(URI.create(CALLBACK_URI))
                .setScopes(SCOPES)
                .setPKCEProvider(new DefaultPKCEProvider())
                .build();

        // Authorization URL 출력
        String authorizationUrl = authorizer.getAuthorizationUrl("user", null, null).toString();
        System.out.println("Go to the following URL to authorize:");
        System.out.println(authorizationUrl);

        // 인증 코드 입력 받기
        System.out.println("Enter the authorization code:");
        String code = new java.util.Scanner(System.in).nextLine();

        // UserCredentials 가져오기
        UserCredentials credentials = authorizer.getAndStoreCredentialsFromCode("user", code, URI.create(CALLBACK_URI));

        // AccessToken 반환
        return credentials.getAccessToken().getTokenValue();
    }
}
