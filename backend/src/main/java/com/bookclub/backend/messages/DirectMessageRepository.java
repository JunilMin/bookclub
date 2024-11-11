// ./messages/DirectMessageRepository.java
package com.bookclub.backend.messages;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

/**
 * Repository interface for managing DirectMessage entities in the "messages"
 * collection.
 */
public interface DirectMessageRepository extends MongoRepository<DirectMessage, ObjectId> {

    /**
     * Finds messages between two specific users.
     *
     * @param senderId   the ID of the sender
     * @param receiverId the ID of the receiver
     * @return a list of direct messages sent between the specified users
     */
    List<DirectMessage> findBySenderIdAndReceiverId(ObjectId senderId, ObjectId receiverId);

    /**
     * Finds all messages received by a specific user.
     *
     * @param receiverId the ID of the receiver
     * @return a list of direct messages received by the specified user
     */
    List<DirectMessage> findByReceiverId(ObjectId receiverId);
}
