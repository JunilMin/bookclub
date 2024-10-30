// ./auth/AuthRequest.java

package com.bookclub.backend.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthRequest {
  private String username;
  private String password;
}
