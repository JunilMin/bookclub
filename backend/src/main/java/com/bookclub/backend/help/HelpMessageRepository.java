package com.bookclub.backend.help;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HelpMessageRepository extends MongoRepository<HelpMessage, String> {
}
