// ./test/user/UserRepositoryTest.java
package com.bookclub.backend.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DataMongoTest // MongoDB에 대한 Repository 테스트
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void findByUsername_ShouldReturnUser_WhenUsernameExists() {
        // given: 특정 사용자 이름을 가진 사용자를 저장
        User user = new User();
        user.setUsername("testuser");
        userRepository.save(user);

        // when: 사용자 이름으로 사용자 조회
        Optional<User> foundUser = userRepository.findByUsername("testuser");

        // then: 사용자가 존재하는지 확인
        assertTrue(foundUser.isPresent());
    }
}
