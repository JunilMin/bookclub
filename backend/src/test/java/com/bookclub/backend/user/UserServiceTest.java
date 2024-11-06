// ./test/user/UserServiceTest.java
package com.bookclub.backend.user;

import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserServiceTest {

    @Mock
    private UserRepository userRepository; // Mock 객체로 UserRepository 생성

    @InjectMocks
    private UserService userService; // UserService 테스트를 위해 주입할 객체

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this); // @Mock, @InjectMocks 어노테이션 초기화
    }

    @Test
    void getAllUsers_ShouldReturnUserList() {
        // given: 두 명의 사용자를 가진 목록
        List<User> users = List.of(new User(), new User());
        when(userRepository.findAll()).thenReturn(users);

        // when: 모든 사용자 조회
        List<User> result = userService.getAllUsers();

        // then: 반환된 사용자의 수가 예상과 일치하는지 확인
        assertEquals(2, result.size());
    }

    @Test
    void getUserById_ShouldReturnUser_WhenIdExists() {
        // given: 특정 ID의 사용자 설정
        ObjectId id = new ObjectId();
        User user = new User();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        // when: ID로 사용자 조회
        Optional<User> result = userService.getUserById(id);

        // then: 사용자가 존재하는지 확인
        assertTrue(result.isPresent());
    }

    @Test
    void registerUser_ShouldThrowException_WhenUsernameExists() {
        // given: 이미 존재하는 사용자 이름으로 사용자 설정
        User user = new User();
        user.setUsername("existingUser");
        when(userRepository.findByUsername("existingUser")).thenReturn(Optional.of(user));

        // when & then: 사용자 이름이 이미 존재할 경우 예외가 발생하는지 확인
        RuntimeException exception = assertThrows(RuntimeException.class, () -> userService.registerUser(user));
        assertEquals("이미 존재하는 사용자입니다.", exception.getMessage());
    }

    @Test
    void registerUser_ShouldEncryptPasswordAndSaveUser() {
        // given: 새로운 사용자 설정 및 비밀번호 암호화 확인
        User user = new User();
        user.setUsername("newUser");
        user.setPassword("password");

        when(userRepository.findByUsername("newUser")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(user);

        // when: 사용자 등록 시도
        User result = userService.registerUser(user);

        // then: 암호화된 비밀번호 확인 및 저장 확인
        assertNotNull(result);
        assertNotEquals("password", result.getPassword()); // 비밀번호가 암호화되었는지 확인
        verify(userRepository).save(any(User.class));
    }

    @Test
    void deleteUser_ShouldDeleteUser_WhenIdExists() {
        // given: 특정 ID의 사용자 설정
        ObjectId id = new ObjectId();

        // when: 사용자 삭제
        userService.deleteUser(id);

        // then: UserRepository의 deleteById가 호출되었는지 확인
        verify(userRepository, times(1)).deleteById(id);
    }
}
