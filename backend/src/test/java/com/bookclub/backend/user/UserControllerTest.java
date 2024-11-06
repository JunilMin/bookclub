package com.bookclub.backend.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc; // 컨트롤러 테스트용 MockMvc 객체

    @MockBean
    private UserService userService; // UserService를 MockBean으로 주입

    @Autowired
    private ObjectMapper objectMapper; // JSON 변환을 위한 ObjectMapper

    private User user;
    private ObjectId userId;

    @BeforeEach
    void setup() {
        // 각 테스트 전에 공통적으로 사용할 User 객체 초기화
        user = new User();
        user.setUsername("testuser");
        user.setPassword("password");

        // 사용자 ID 초기화
        userId = new ObjectId();
    }

    @Test
    void getAllUsers_ShouldReturnListOfUsers() throws Exception {
        // given
        when(userService.getAllUsers()).thenReturn(List.of(user));

        // when & then
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("testuser"));
    }

    @Test
    void getUserById_ShouldReturnUser_WhenIdExists() throws Exception {
        // given
        when(userService.getUserById(userId)).thenReturn(Optional.of(user));

        // when & then
        mockMvc.perform(get("/api/users/" + userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    void registerUser_ShouldReturnSuccessMessage_WhenUserIsRegistered() throws Exception {
        // given
        when(userService.registerUser(any(User.class))).thenReturn(user);

        // when & then
        mockMvc.perform(post("/api/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(content().string("User registered successfully: testuser"));
    }

    @Test
    void deleteUser_ShouldReturnNoContent_WhenUserIsDeleted() throws Exception {
        // when & then
        mockMvc.perform(delete("/api/users/" + userId.toString()))
                .andExpect(status().isNoContent());
    }
}
