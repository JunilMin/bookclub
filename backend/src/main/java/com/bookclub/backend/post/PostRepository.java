// ./post/PostRepository.java

package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface PostRepository extends MongoRepository<Post, ObjectId> {
  List<Post> findByCreater(String creater);
  Optional<Post> findById(String id);
  List<Post> findByUsername(String username);
}
