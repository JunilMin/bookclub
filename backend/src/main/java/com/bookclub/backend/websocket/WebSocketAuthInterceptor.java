package com.bookclub.backend.websocket;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Optional;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    @Autowired
    private UserService userService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Extract token from headers
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);

                try {
                    // Verify Firebase token
                    FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
                    String uid = decodedToken.getUid();
                    String email = decodedToken.getEmail();

                    // Get User from database by Firebase UID
                    Optional<User> userOpt = userService.getUserByUID(uid, token);
                    if (userOpt.isEmpty()) {
                        throw new RuntimeException("User not found for UID: " + uid);
                    }

                    User user = userOpt.get();
                    String userId = user.getId();  // MongoDB ObjectId

                    // Create authentication principal with userId
                    WebSocketPrincipal principal = new WebSocketPrincipal(userId, uid, email);

                    // Set user authentication
                    UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                            principal,
                            null,
                            Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                        );

                    accessor.setUser(authentication);

                } catch (FirebaseAuthException e) {
                    throw new RuntimeException("Invalid Firebase token: " + e.getMessage());
                } catch (Exception e) {
                    throw new RuntimeException("Authentication failed: " + e.getMessage());
                }
            }
        }

        return message;
    }
}
