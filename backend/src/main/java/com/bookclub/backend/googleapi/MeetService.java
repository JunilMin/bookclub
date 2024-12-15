package com.bookclub.backend.googleapi;

import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.apps.meet.v2.CreateSpaceRequest;
import com.google.apps.meet.v2.Space;
import com.google.apps.meet.v2.SpacesServiceClient;
import com.google.apps.meet.v2.SpacesServiceSettings;
import com.google.auth.Credentials;
import com.google.auth.oauth2.ClientId;
import com.google.auth.oauth2.UserAuthorizer;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.util.Collections;
import java.util.List;

@Service
public class MeetService {

    private static final String CREDENTIALS_FILE_PATH = "/credentials.json";
    private static final String CALLBACK_URI = "http://localhost:8888/api/meet/callback";
    private static final List<String> SCOPES = Collections.singletonList("https://www.googleapis.com/auth/meetings");

    public String createSpace() throws Exception {
        // PKCE 코드 생성
        String codeVerifier = PKCEUtils.generateCodeVerifier();
        String codeChallenge = PKCEUtils.generateCodeChallenge(codeVerifier);

        // UserAuthorizer 초기화
        UserAuthorizer authorizer = getUserAuthorizer();

        // OAuth Authorization URL 출력
        String authorizationUrl = authorizer.getAuthorizationUrl("user", null, null) +
                "&code_challenge=" + codeChallenge +
                "&code_challenge_method=S256";
        System.out.println("Go to the following URL to authorize: ");
        System.out.println(authorizationUrl);

        // 인증 코드 입력
        System.out.println("Enter the authorization code:");
        String code = new java.util.Scanner(System.in).nextLine();

        // Access Token 저장
        Credentials credentials = authorizer.getAndStoreCredentialsFromCode("user", code, URI.create(CALLBACK_URI));

        // Google Meet API 호출
        SpacesServiceSettings settings = SpacesServiceSettings.newBuilder()
                .setCredentialsProvider(FixedCredentialsProvider.create(credentials))
                .build();

        try (SpacesServiceClient spacesServiceClient = SpacesServiceClient.create(settings)) {
            CreateSpaceRequest request = CreateSpaceRequest.newBuilder()
                    .setSpace(Space.newBuilder().build())
                    .build();
            Space response = spacesServiceClient.createSpace(request);
            return response.getMeetingUri();
        }
    }

    private UserAuthorizer getUserAuthorizer() throws Exception {
        InputStream credentialsStream = MeetService.class.getResourceAsStream(CREDENTIALS_FILE_PATH);
        if (credentialsStream == null) {
            throw new IllegalArgumentException("credentials.json 파일을 찾을 수 없습니다.");
        }
        ClientId clientId = ClientId.fromStream(credentialsStream);

        return UserAuthorizer.newBuilder()
                .setClientId(clientId)
                .setScopes(SCOPES)
                .setCallbackUri(URI.create(CALLBACK_URI))
                .setTokenStore(new SimpleTokenStore()) // Custom TokenStore 사용
                .build();
    }
}
