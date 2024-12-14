// package com.bookclub.backend.googleapi;

// import com.google.api.gax.core.FixedCredentialsProvider;
// import com.google.apps.meet.v2.CreateSpaceRequest;
// import com.google.apps.meet.v2.Space;
// import com.google.apps.meet.v2.SpacesServiceClient;
// import com.google.apps.meet.v2.SpacesServiceSettings;
// import com.google.auth.Credentials;
// import com.google.auth.oauth2.UserAuthorizer;
// import org.springframework.stereotype.Service;

// import java.awt.*;
// import java.io.FileNotFoundException;
// import java.io.IOException;
// import java.io.InputStream;
// import java.net.URI;
// import java.net.URL;
// import java.nio.file.Files;
// import java.nio.file.Path;
// import java.nio.file.Paths;
// import java.util.Collections;
// import java.util.List;

// @Service
// public class GoogleMeetService {

//     private static final String TOKENS_DIRECTORY_PATH = "tokens";
//     private static final String CREDENTIALS_FILE_PATH = "/credentials.json";
//     private static final List<String> SCOPES = Collections.singletonList("https://www.googleapis.com/auth/meetings.space.created");
//     private static final String USER = "default";

//     private static Credentials getCredentials() throws Exception {
//         var receiver = new LocalServerReceiver.Builder().build();
//         URI callbackUri = URI.create(receiver.getRedirectUri());
//         UserAuthorizer authorizer = getAuthorizer(callbackUri);

//         Credentials credentials = authorizer.getCredentials(USER);
//         if (credentials != null) {
//             return credentials;
//         }

//         URL authorizationUrl = authorizer.getAuthorizationUrl(USER, "", null);
//         if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
//             Desktop.getDesktop().browse(authorizationUrl.toURI());
//         } else {
//             System.out.printf("Open the following URL to authorize access: %s\n", authorizationUrl.toExternalForm());
//         }

//         String code = receiver.waitForCode();
//         credentials = authorizer.getAndStoreCredentialsFromCode(USER, code, callbackUri);
//         receiver.stop();
//         return credentials;
//     }

//     private static UserAuthorizer getAuthorizer(URI callbackUri) throws IOException {
//         try (InputStream in = GoogleMeetService.class.getResourceAsStream(CREDENTIALS_FILE_PATH)) {
//             if (in == null) {
//                 throw new FileNotFoundException("Resource not found: " + CREDENTIALS_FILE_PATH);
//             }

//             var clientId = ClientId.fromStream(in);
//             return UserAuthorizer.newBuilder()
//                     .setClientId(clientId)
//                     .setCallbackUri(callbackUri)
//                     .setScopes(SCOPES)
//                     .build();
//         }
//     }

//     public String createGoogleMeetSpace() {
//         try {
//             Credentials credentials = getCredentials();
//             var settings = SpacesServiceSettings.newBuilder()
//                     .setCredentialsProvider(FixedCredentialsProvider.create(credentials))
//                     .build();

//             try (SpacesServiceClient spacesServiceClient = SpacesServiceClient.create(settings)) {
//                 var request = CreateSpaceRequest.newBuilder()
//                         .setSpace(Space.newBuilder().build())
//                         .build();
//                 var response = spacesServiceClient.createSpace(request);
//                 return response.getMeetingUri();
//             }
//         } catch (Exception e) {
//             throw new RuntimeException("Failed to create Google Meet space: " + e.getMessage(), e);
//         }
//     }
// }
