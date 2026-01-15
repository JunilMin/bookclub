// ./post/PostRepository.java

package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface PostRepository extends MongoRepository<Post, String> {
  List<Post> findByCreaterId(String createrId);
  Optional<Post> findById(String id);
}
