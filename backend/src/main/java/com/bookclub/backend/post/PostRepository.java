// ./post/PostRepository.java
package com.bookclub.backend.post;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PostRepository extends MongoRepository<Post, ObjectId> {
  List<Post> findByCreater(ObjectId creater);
}