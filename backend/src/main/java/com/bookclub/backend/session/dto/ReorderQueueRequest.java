package com.bookclub.backend.session.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ReorderQueueRequest {
    private List<String> userIds;  // Ordered list of user IDs (MongoDB ObjectIds)
}
