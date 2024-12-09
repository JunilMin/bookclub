package com.bookclub.backend.user;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.bookclub.backend.googleapi.GoogleCalendarService;
import com.google.api.services.calendar.model.Event;

import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

  @Autowired
  private UserService userService;
  
  @Autowired
  private GoogleCalendarService googleCalendarService;

   /**
     * Google Calendar 열기 (웹 브라우저)
     */
    @GetMapping("/{userId}/google-calendar/open")
    public ResponseEntity<?> openGoogleCalendar() {
        try {
            URI calendarUri = new URI("https://calendar.google.com/");
            return ResponseEntity.status(302).location(calendarUri).build();
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error opening Google Calendar: " + e.getMessage());
        }
    }

    /**
     * Google Calendar 이벤트 조회
     */
    @GetMapping("/{userId}/google-calendar/events")
    public ResponseEntity<?> listEvents(@PathVariable String userId, @RequestParam String accessToken) {
        try {
            List<Event> events = googleCalendarService.listEvents(accessToken);
            return ResponseEntity.ok(events);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error listing events: " + e.getMessage());
        }
    }

    /**
     * Google Calendar 이벤트 추가
     */
    @PostMapping("/{userId}/google-calendar/add-event")
    public ResponseEntity<?> addEvent(
            @PathVariable String userId,
            @RequestParam String accessToken,
            @RequestParam String summary,
            @RequestParam Date startDate,
            @RequestParam Date endDate
    ) {
        try {
            Event event = googleCalendarService.addEvent(accessToken, summary, startDate, endDate);
            return ResponseEntity.ok(event);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error adding event: " + e.getMessage());
        }
    }

    /**
     * Google Calendar 이벤트 삭제
     */
    @DeleteMapping("/{userId}/google-calendar/delete-event")
    public ResponseEntity<?> deleteEvent(
            @PathVariable String userId,
            @RequestParam String accessToken,
            @RequestParam String eventId
    ) {
        try {
            googleCalendarService.deleteEvent(accessToken, eventId);
            return ResponseEntity.ok("Event deleted successfully.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error deleting event: " + e.getMessage());
        }
    }

    /**
     * Google Calendar 이벤트 수정
     */
    @PutMapping("/{userId}/google-calendar/update-event")
    public ResponseEntity<?> updateEvent(
            @PathVariable String userId,
            @RequestParam String accessToken,
            @RequestParam String eventId,
            @RequestParam String summary,
            @RequestParam Date startDate,
            @RequestParam Date endDate
    ) {
        try {
            Event updatedEvent = googleCalendarService.updateEvent(accessToken, eventId, summary, startDate, endDate);
            return ResponseEntity.ok(updatedEvent);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error updating event: " + e.getMessage());
        }
    }
    
  /**
   * 모든 사용자 조회
   */
  @GetMapping
  public List<User> getAllUsers() {
    return userService.getAllUsers();
  }

  /**
   * ID로 사용자 조회
   */
  @GetMapping("/{id}")
  public ResponseEntity<User> getUserById(@PathVariable String id) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      Optional<User> user = userService.getUserById(objectId);
      return user.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }
  /**
   * Firebase JWT를 디코드하여 UID로 사용자 정보 조회
   *
   * @param token Firebase JWT 토큰
   * @return 사용자 정보
   */
  @GetMapping("/uid")
  public ResponseEntity<?> getUserByUID(@RequestHeader("Authorization") String token) {
      try {
          // "Bearer " 접두사 제거
          String uid = token;
          if (uid.startsWith("Bearer ")) {
              uid = uid.substring(7);
          }

          return userService.getUserByUID(uid)
                  .map(ResponseEntity::ok)
                  .orElse(ResponseEntity.notFound().build());
      } catch (Exception e) {
          return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
      }
  }
  
  /**
   * Firebase UID를 받아서 사용자 정보 조회
   *
   * @param token Firebase JWT 토큰
   * @return 사용자 정보
   */
  @GetMapping("/uid/{uid}")
  public ResponseEntity<?> getUserByUID(@PathVariable String uid, @RequestHeader("Authorization") String token) {
      try {
          return userService.getUserByUID(uid, token)
                  .map(ResponseEntity::ok)
                  .orElse(ResponseEntity.notFound().build());
      } catch (Exception e) {
          return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
      }
  }
  /**
   * 사용자 이름으로 사용자 조회
   */
  @GetMapping("/username/{username}")
  public Optional<User> getUserByUsername(@PathVariable String username) {
    return userService.getUserByUsername(username);
  }

  /**
   * 회원가입 요청을 처리하고 새로운 사용자를 생성합니다.
   *
   * @param user 회원가입 요청에서 제공된 사용자 정보
   * @return 성공 메시지 또는 오류 메시지를 포함한 ResponseEntity 반환
   */
  @PostMapping("/register")
  public ResponseEntity<?> registerUser(@RequestBody User user) {
    try {
      User registeredUser = userService.registerUser(user);
      return ResponseEntity.ok("User registered successfully: " + registeredUser.getUsername());
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(e.getMessage());
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  @PutMapping("/{id}")
  public ResponseEntity<User> updateUser(@PathVariable String id, @RequestBody User updatedUser) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      User user = userService.updateUser(objectId, updatedUser);
      if (user != null) {
        return ResponseEntity.ok(user);
      } else {
        return ResponseEntity.notFound().build();
      }
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 사용자 삭제
   */
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteUser(@PathVariable String id) {
    try {
      ObjectId objectId = new ObjectId(id); // 문자열로 받은 id를 ObjectId로 변환
      userService.deleteUser(objectId);
      return ResponseEntity.noContent().build();
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    }
  }

  /**
   * 친구 추가 요청을 처리합니다.
   * 
   * @param userId   친구를 추가할 사용자의 ID
   * @param friendId 추가할 친구의 ID
   * @return 성공적으로 추가된 사용자 정보
   */
  @PostMapping("/{userId}/add-friend/{friendId}")
  public ResponseEntity<User> addFriend(@PathVariable String userId, @PathVariable String friendId) {
    try {
      ObjectId userObjectId = new ObjectId(userId);
      ObjectId friendObjectId = new ObjectId(friendId);
      User user = userService.addFriend(userObjectId, friendObjectId);
      return ResponseEntity.ok(user);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().build(); // 유효하지 않은 ObjectId 형식에 대한 예외 처리
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(null); // 이미 친구이거나 다른 오류 시 예외 처리
    }
  }

  /**
   * 이메일 인증 토큰을 재전송합니다.
   *
   * @param email 인증 토큰을 재전송할 이메일 주소
   * @return 성공 또는 오류 메시지를 포함한 응답
   */
  // @PostMapping("/resend-verification/{email}")
  // public ResponseEntity<?> resendVerificationToken(@PathVariable("email") String email) {
  //   try {
  //     userService.resendVerificationToken(email);
  //     return ResponseEntity.ok("새로운 인증 이메일이 발송되었습니다.");
  //   } catch (RuntimeException e) {
  //     return ResponseEntity.badRequest().body(e.getMessage());
  //   }
  // }

  // Verification status check endpoint
  // @GetMapping("/verify-email-check/{email}")
  // public ResponseEntity<Boolean> verificationStatus(@PathVariable("email") String email) {
  //   if (email != null) {
  //     boolean isVerified = userService.checkVerificationStatus(email);
  //     return ResponseEntity.ok(isVerified);
  //   } else {
  //     return ResponseEntity.badRequest().body(false);
  //   }
  // }



  // // Email verification endpoint
  // @GetMapping("/verification-token/{email}")
  // public ResponseEntity<String> getVerificationToken(@PathVariable("email") String email) {
  //   String token = userService.getVerificationToken(email);
  //   if (token != null) {
  //     return ResponseEntity.ok(token);
  //   } else {
  //     return ResponseEntity.status(400).body("Verification token not found");
  //   }
  // }
}
