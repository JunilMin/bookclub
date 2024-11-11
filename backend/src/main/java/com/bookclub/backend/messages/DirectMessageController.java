// ./messages/DirectMessageController.java
package com.bookclub.backend.messages;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for handling direct message API requests.
 * Provides endpoints for sending and retrieving messages.
 */
@RestController
@RequestMapping("/api/messages")
public class DirectMessageController {

    @Autowired
    private DirectMessageService directMessageService;

    /**
     * Sends a direct message from one user to another.
     *
     * @param senderId   the ID of the user sending the message
     * @param receiverId the ID of the user receiving the message
     * @param message    the content of the message
     * @return the sent DirectMessage object
     */
    @PostMapping("/send")
    public ResponseEntity<DirectMessage> sendMessage(@RequestParam String senderId,
            @RequestParam String receiverId,
            @RequestParam String message) {
        ObjectId senderObjectId = new ObjectId(senderId);
        ObjectId receiverObjectId = new ObjectId(receiverId);
        DirectMessage sentMessage = directMessageService.sendMessage(senderObjectId, receiverObjectId, message);
        return ResponseEntity.ok(sentMessage);
    }

    /**
     * Retrieves all direct messages exchanged between two users.
     *
     * @param senderId   the ID of the sender
     * @param receiverId the ID of the receiver
     * @return a list of DirectMessage objects exchanged between the users
     */
    @GetMapping("/between")
    public List<DirectMessage> getMessagesBetweenUsers(@RequestParam String senderId,
            @RequestParam String receiverId) {
        ObjectId senderObjectId = new ObjectId(senderId);
        ObjectId receiverObjectId = new ObjectId(receiverId);
        return directMessageService.getMessagesBetweenUsers(senderObjectId, receiverObjectId);
    }

    /**
     * Retrieves all direct messages received by a specific user.
     *
     * @param userId the ID of the user
     * @return a list of DirectMessage objects received by the user
     */
    @GetMapping("/user/{userId}")
    public List<DirectMessage> getMessagesForUser(@PathVariable String userId) {
        ObjectId userObjectId = new ObjectId(userId);
        return directMessageService.getMessagesForUser(userObjectId);
    }
}
