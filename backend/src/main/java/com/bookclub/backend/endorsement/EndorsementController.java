// ./endorsement/EndorsementController.java
package com.bookclub.backend.endorsement;

import com.bookclub.backend.endorsement.dto.EndorsementRequest;
import com.bookclub.backend.endorsement.dto.EndorsementResponse;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for endorsement API endpoints.
 */
@RestController
@RequestMapping("/api/endorsements")
@CrossOrigin(origins = "http://localhost:5173")
public class EndorsementController {

    @Autowired
    private EndorsementService endorsementService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Submit an endorsement for a participant.
     * POST /api/endorsements
     */
    @PostMapping
    public ResponseEntity<?> submitEndorsement(
            @RequestBody EndorsementRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // 1. Extract user from Firebase token
            String evaluatorUserId = extractUserId(authHeader);
            if (evaluatorUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }

            // 2. Submit endorsement
            EndorsementResponse response = endorsementService.submitEndorsement(
                evaluatorUserId, request);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (DuplicateEndorsementException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "code", "ENDORSEMENT_ALREADY_SUBMITTED",
                            "message", e.getMessage()
                    ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                            "code", "INVALID_REQUEST",
                            "message", e.getMessage()
                    ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to submit endorsement: " + e.getMessage()
                    ));
        }
    }

    /**
     * Get pending participants for endorsement.
     * GET /api/endorsements/pending?sessionId=...
     */
    @GetMapping("/pending")
    public ResponseEntity<?> getPendingParticipants(
            @RequestParam String sessionId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Extract user from Firebase token
            String evaluatorUserId = extractUserId(authHeader);
            if (evaluatorUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }

            EndorsementResponse.PendingResponse response =
                endorsementService.getPendingParticipants(sessionId, evaluatorUserId);

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of(
                            "code", "NOT_FOUND",
                            "message", e.getMessage()
                    ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to get pending participants: " + e.getMessage()
                    ));
        }
    }

    /**
     * Check if endorsement already exists.
     * GET /api/endorsements/exists?sessionId=...&targetUserId=...
     */
    @GetMapping("/exists")
    public ResponseEntity<?> checkEndorsementExists(
            @RequestParam String sessionId,
            @RequestParam String targetUserId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Extract user from Firebase token
            String evaluatorUserId = extractUserId(authHeader);
            if (evaluatorUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("code", "USER_NOT_FOUND", "message", "User not found"));
            }

            boolean exists = endorsementService.endorsementExists(
                sessionId, evaluatorUserId, targetUserId);

            return ResponseEntity.ok(Map.of("exists", exists));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "code", "INTERNAL_ERROR",
                            "message", "Failed to check endorsement: " + e.getMessage()
                    ));
        }
    }

    /**
     * Extract MongoDB user ID from Firebase token.
     *
     * @param authHeader The Authorization header containing Bearer token
     * @return The user's MongoDB ID, or null if not found
     */
    private String extractUserId(String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();

            Optional<User> userOpt = userRepository.findByUid(uid);
            if (userOpt.isEmpty()) {
                return null;
            }
            return userOpt.get().getId();
        } catch (Exception e) {
            return null;
        }
    }
}
