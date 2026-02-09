package com.bookclub.backend.help;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/help")
@CrossOrigin(origins = "http://localhost:5173")
public class HelpMessageController {

    @Autowired
    private HelpMessageRepository helpMessageRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * 문의하기 (로그인/비로그인 모두 가능)
     * POST /api/help
     */
    @PostMapping
    public ResponseEntity<?> submitHelpMessage(
            @RequestBody Map<String, String> body,
            HttpServletRequest httpRequest) {
        try {
            String email = body.get("email");
            String contents = body.get("contents");

            if (email == null || email.isBlank() || contents == null || contents.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "email and contents are required"));
            }

            // 토큰이 있으면 로그인 사용자
            String uid = extractUid(httpRequest);

            if (uid != null) {
                Optional<User> userOpt = userRepository.findByUid(uid);
                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    HelpMessage msg = new HelpMessage(email, contents, user.getId(), user.getUsername());
                    helpMessageRepository.save(msg);
                    return ResponseEntity.ok(Map.of("success", true, "loggedIn", true));
                }
            }

            // 비로그인 또는 유저 조회 실패
            HelpMessage msg = new HelpMessage(email, contents);
            helpMessageRepository.save(msg);
            return ResponseEntity.ok(Map.of("success", true, "loggedIn", false));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to submit: " + e.getMessage()));
        }
    }

    /**
     * 토큰에서 Firebase UID 추출 (없거나 무효하면 null)
     */
    private String extractUid(HttpServletRequest request) {
        String token = null;

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        if (token == null) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("firebase_token".equals(cookie.getName())) {
                        token = cookie.getValue();
                        break;
                    }
                }
            }
        }

        if (token == null) return null;

        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            return decodedToken.getUid();
        } catch (Exception e) {
            return null;
        }
    }
}
