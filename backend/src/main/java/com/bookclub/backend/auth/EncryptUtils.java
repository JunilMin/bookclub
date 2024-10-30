// File: ./auth/EncryptUtils.java
package com.bookclub.backend.auth;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

/**
 * AES 알고리즘을 사용하여 문자열을 암호화하고 복호화하는 유틸리티 클래스입니다.
 * 이 클래스는 고정된 16바이트 비밀 키를 사용하여 암호화 및 복호화 메서드를 제공합니다.
 */
public class EncryptUtils {

  private static final String ALGORITHM = "AES";
  private static final byte[] KEY = "MySuperSecretKey".getBytes(); // 정확히 16바이트여야 합니다.

  /**
   * 평문 문자열을 AES 암호화를 사용하여 암호화하고, Base64로 인코딩합니다.
   *
   * @param plainText 암호화할 평문 텍스트
   * @return Base64로 인코딩된 암호화된 텍스트
   * @throws Exception 암호화 오류가 발생한 경우
   */
  public static String encrypt(String plainText) throws Exception {
    SecretKeySpec secretKey = new SecretKeySpec(KEY, ALGORITHM);
    Cipher cipher = Cipher.getInstance(ALGORITHM);
    cipher.init(Cipher.ENCRYPT_MODE, secretKey);
    byte[] encryptedBytes = cipher.doFinal(plainText.getBytes("UTF-8"));
    return Base64.getEncoder().encodeToString(encryptedBytes); // Base64로 인코딩
  }

  /**
   * Base64로 인코딩된 AES 암호화 문자열을 복호화하여 평문으로 반환합니다.
   *
   * @param encryptedText 복호화할 Base64로 인코딩된 암호화 텍스트
   * @return 복호화된 평문 텍스트
   * @throws Exception 복호화 오류가 발생한 경우
   */
  public static String decrypt(String encryptedText) throws Exception {
    SecretKeySpec secretKey = new SecretKeySpec(KEY, ALGORITHM);
    Cipher cipher = Cipher.getInstance(ALGORITHM);
    cipher.init(Cipher.DECRYPT_MODE, secretKey);
    byte[] decodedBytes = Base64.getDecoder().decode(encryptedText); // Base64로 디코딩
    byte[] decryptedBytes = cipher.doFinal(decodedBytes);
    return new String(decryptedBytes, "UTF-8");
  }
}
