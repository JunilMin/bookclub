package com.bookclub.backend.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

  @Autowired
  private UserRepository userRepository;

  public List<User> getAllUsers() {
    return userRepository.findAll();
  }

  public Optional<User> getUserById(String id) {
    return userRepository.findById(id);
  }

  public Optional<User> getUserByUsername(String username) {
    return userRepository.findByUsername(username);
  }

  public User createUser(User user) {
    return userRepository.save(user);
  }

  public User updateUser(String id, User updatedUser) {
    Optional<User> existingUser = userRepository.findById(id);
    if (existingUser.isPresent()) {
      User user = existingUser.get();
      user.setUsername(updatedUser.getUsername());
      user.setPassword(updatedUser.getPassword());
      user.setPosts(updatedUser.getPosts());
      user.setRating(updatedUser.getRating());
      user.setAbsent(updatedUser.getAbsent());
      user.setFriends(updatedUser.getFriends());
      user.setLate(updatedUser.getLate());
      return userRepository.save(user);
    } else {
      return null;
    }
  }

  public void deleteUser(String id) {
    userRepository.deleteById(id);
  }
}
