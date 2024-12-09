// ./user/UserRepository.java
package com.bookclub.backend.user;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, ObjectId> {
  Optional<User> findByUsername(String username);
  Optional<User> findByEmail(String email);  // 이메일로 사용자 조회
  // Optional<User> findByVerificationToken(String verificationToken);
  Optional<User> findByUid(String uid);
}

