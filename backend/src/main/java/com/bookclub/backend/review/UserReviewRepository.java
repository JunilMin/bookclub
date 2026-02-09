package com.bookclub.backend.review;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserReviewRepository extends MongoRepository<UserReview, String> {
    Optional<UserReview> findByUserId(String userId);
}
