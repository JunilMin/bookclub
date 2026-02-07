package com.bookclub.backend.user.controller;

import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserService;
import com.bookclub.backend.user.model.UserBadge;
import com.bookclub.backend.user.service.UserBadgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * 사용자 배지 관리 API
 */
@RestController
@RequestMapping("/api/badges")
public class UserBadgeController {

    @Autowired
    private UserBadgeService userBadgeService;

    @Autowired
    private UserService userService;

    /**
     * 특정 사용자의 배지 정보 조회
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<UserBadge> getUserBadges(@PathVariable String userId) {
        try {
            UserBadge userBadge = userBadgeService.getUserBadges(userId);
            return ResponseEntity.ok(userBadge);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * 현재 로그인한 사용자의 배지 정보 조회
     */
    @GetMapping("/me")
    public ResponseEntity<?> getMyBadges(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);

            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            UserBadge userBadge = userBadgeService.getUserBadges(userOpt.get().getId());
            return ResponseEntity.ok(userBadge);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 배지 달성 상태 확인 및 업데이트
     */
    @PostMapping("/check/{userId}")
    public ResponseEntity<UserBadge> checkAndUpdateBadges(@PathVariable String userId) {
        try {
            UserBadge userBadge = userBadgeService.checkAndUpdateBadges(userId);
            return ResponseEntity.ok(userBadge);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 현재 사용자의 배지 달성 상태 확인 및 업데이트
     */
    @PostMapping("/me/check")
    public ResponseEntity<?> checkMyBadges(@RequestHeader("Authorization") String token) {
        try {
            String cleanToken = token.startsWith("Bearer ") ? token.substring(7) : token;
            Optional<User> userOpt = userService.getUserByUID(cleanToken);

            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            UserBadge userBadge = userBadgeService.checkAndUpdateBadges(userOpt.get().getId());
            return ResponseEntity.ok(userBadge);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("오류 발생: " + e.getMessage());
        }
    }

    /**
     * 획득한 배지 ID 목록 조회
     */
    @GetMapping("/user/{userId}/earned")
    public ResponseEntity<List<String>> getEarnedBadgeIds(@PathVariable String userId) {
        try {
            List<String> earnedIds = userBadgeService.getEarnedBadgeIds(userId);
            return ResponseEntity.ok(earnedIds);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 획득한 배지 수 조회
     */
    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Integer> getEarnedBadgeCount(@PathVariable String userId) {
        try {
            int count = userBadgeService.getEarnedBadgeCount(userId);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
