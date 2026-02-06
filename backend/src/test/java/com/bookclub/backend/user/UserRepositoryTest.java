package com.bookclub.backend.user;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DataMongoTest
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    private String uniqueUsername;
    private User savedUser;

    @BeforeEach
    void setup() {
        // 각 테스트마다 고유한 username 생성
        uniqueUsername = "testuser_" + UUID.randomUUID().toString().substring(0, 8);
    }

    @AfterEach
    void cleanup() {
        // 테스트 후 생성된 사용자 삭제
        if (savedUser != null && savedUser.getId() != null) {
            userRepository.deleteById(savedUser.getId());
        }
    }

    @Test
    void findByUsername_ShouldReturnUser_WhenUsernameExists() {
        // given: 고유한 사용자 이름으로 사용자 저장
        User user = new User();
        user.setUsername(uniqueUsername);
        savedUser = userRepository.save(user);

        // when: 사용자 이름으로 사용자 조회
        Optional<User> foundUser = userRepository.findByUsername(uniqueUsername);

        // then: 사용자가 존재하는지 확인
        assertTrue(foundUser.isPresent());
    }
}
