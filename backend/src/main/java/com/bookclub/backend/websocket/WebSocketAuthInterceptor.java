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

            // 토큰이 없으면 연결 거부
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                throw new IllegalArgumentException("WebSocket connection requires authentication token");
            }

            String token = authHeader.substring(7);

            // 빈 토큰 체크
            if (token.isEmpty()) {
                throw new IllegalArgumentException("Empty authentication token");
            }

            try {
                // Verify Firebase token
                FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
                String uid = decodedToken.getUid();
                String email = decodedToken.getEmail();

                // Get User from database by Firebase UID
                Optional<User> userOpt = userService.getUserByUID(uid, token);
                if (userOpt.isEmpty()) {
                    throw new IllegalArgumentException("User not found for UID: " + uid);
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
                // 토큰 만료 또는 유효하지 않은 토큰
                throw new IllegalArgumentException("Invalid or expired Firebase token: " + e.getMessage());
            } catch (IllegalArgumentException e) {
                // 이미 처리된 예외는 그대로 던지기
                throw e;
            } catch (Exception e) {
                throw new IllegalArgumentException("WebSocket authentication failed: " + e.getMessage());
            }
        }

        return message;
    }
}
