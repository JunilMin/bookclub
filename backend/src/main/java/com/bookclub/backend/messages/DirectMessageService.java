// ./messages/DirectMessageService.java
package com.bookclub.backend.messages;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service class for managing direct messages between users.
 * Handles the business logic for sending and retrieving messages.
 */
@Service
public class DirectMessageService {

    @Autowired
    private DirectMessageRepository directMessageRepository;

    /**
     * Sends a direct message from one user to another.
     *
     * @param senderId   the ID of the user sending the message
     * @param receiverId the ID of the user receiving the message
     * @param message    the content of the message
     * @return the sent DirectMessage object
     */
    public DirectMessage sendMessage(ObjectId senderId, ObjectId receiverId, String message) {
        DirectMessage directMessage = new DirectMessage(senderId, receiverId, message);
        return directMessageRepository.save(directMessage);
    }

    /**
     * Retrieves all direct messages exchanged between two users.
     *
     * @param senderId   the ID of the sender
     * @param receiverId the ID of the receiver
     * @return a list of DirectMessage objects exchanged between the users
     */
    public List<DirectMessage> getMessagesBetweenUsers(ObjectId senderId, ObjectId receiverId) {
        return directMessageRepository.findBySenderIdAndReceiverId(senderId, receiverId);
    }

    /**
     * Retrieves all direct messages received by a specific user.
     *
     * @param userId the ID of the user
     * @return a list of DirectMessage objects received by the user
     */
    public List<DirectMessage> getMessagesForUser(ObjectId userId) {
        return directMessageRepository.findByReceiverId(userId);
    }
}
