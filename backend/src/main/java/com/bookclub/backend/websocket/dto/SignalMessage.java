package com.bookclub.backend.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WebRTC signaling message DTO.
 * Used for exchanging SDP offers/answers and ICE candidates between peers.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SignalMessage {

    /**
     * Signal type: OFFER, ANSWER, ICE, or JOIN (presence notification)
     */
    private String type;

    /**
     * Meeting session ID
     */
    private String sessionId;

    /**
     * Sender's user ID
     */
    private String fromUserId;

    /**
     * Target user ID (who should receive this signal)
     */
    private String toUserId;

    /**
     * Signal payload - JSON string containing:
     * - For OFFER/ANSWER: RTCSessionDescriptionInit (type, sdp)
     * - For ICE: RTCIceCandidateInit (candidate, sdpMid, sdpMLineIndex)
     */
    private Object payload;

    /**
     * Sender's username (for display purposes)
     */
    private String fromUsername;
}
