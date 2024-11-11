// ./messages/DirectMessage.java
package com.bookclub.backend.messages;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

/**
 * Represents a direct message between two users.
 * Stores information about the sender, receiver, message content, and
 * timestamp.
 */
@Document(collection = "messages")
@Getter
@Setter
@NoArgsConstructor
public class DirectMessage {

    @Id
    private ObjectId id;

    /** The ID of the user sending the message */
    private ObjectId senderId;

    /** The ID of the user receiving the message */
    private ObjectId receiverId;

    /** The content of the message */
    private String message;

    /** The timestamp of when the message was sent */
    private LocalDateTime timestamp;

    /**
     * Constructs a new DirectMessage with sender ID, receiver ID, and message
     * content.
     * 
     * @param senderId   the ID of the user sending the message
     * @param receiverId the ID of the user receiving the message
     * @param message    the content of the message
     */
    public DirectMessage(ObjectId senderId, ObjectId receiverId, String message) {
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }
}
