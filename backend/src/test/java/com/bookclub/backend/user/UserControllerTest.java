package com.bookclub.backend.user;

import com.bookclub.backend.moderation.PerspectiveService;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private PerspectiveService perspectiveService;

    @InjectMocks
    private UserController userController;

    private User user;
    private ObjectId userId;
    private String userIdString;

    @BeforeEach
    void setup() {
        user = new User();
        user.setUsername("testuser");
        user.setPassword("password");
        userId = new ObjectId();
        userIdString = userId.toString();
    }

    @Test
    void getAllUsers_ShouldReturnListOfUsers() {
        when(userService.getAllUsers()).thenReturn(List.of(user));

        List<User> response = userController.getAllUsers();

        assertNotNull(response);
        assertEquals(1, response.size());
        assertEquals("testuser", response.get(0).getUsername());
    }

    @Test
    void getUserById_ShouldReturnUser_WhenIdExists() {
        when(userService.getUserById(any(ObjectId.class))).thenReturn(Optional.of(user));

        ResponseEntity<User> response = userController.getUserById(userIdString);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("testuser", response.getBody().getUsername());
    }

    @Test
    void registerUser_ShouldReturnSuccessMessage_WhenUserIsRegistered() {
        when(userService.registerUser(any(User.class))).thenReturn(user);

        ResponseEntity<?> response = userController.registerUser(user);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("User registered successfully: testuser", response.getBody());
    }

    @Test
    void deleteUser_ShouldReturnNoContent_WhenUserIsDeleted() {
        doNothing().when(userService).deleteUser(any(ObjectId.class));

        ResponseEntity<Void> response = userController.deleteUser(userIdString);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(userService, times(1)).deleteUser(any(ObjectId.class));
    }
}
