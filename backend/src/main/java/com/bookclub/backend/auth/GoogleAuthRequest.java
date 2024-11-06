// ./auth/GoogleAuthRequest.java
package com.bookclub.backend.auth;

import lombok.Getter;
import lombok.Setter;

/**
 * Google 로그인 요청에서 이메일과 이름을 전달받기 위한 요청 객체입니다.
 */
@Getter
@Setter
public class GoogleAuthRequest {
  private String email;
  private String name;
}
