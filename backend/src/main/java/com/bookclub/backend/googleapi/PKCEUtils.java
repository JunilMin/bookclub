package com.bookclub.backend.googleapi;


import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Random;

public class PKCEUtils {

    // Code Verifier 생성
    public static String generateCodeVerifier() {
        Random random = new Random();
        byte[] code = new byte[32];
        random.nextBytes(code);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(code);
    }

    // Code Challenge 생성
    public static String generateCodeChallenge(String codeVerifier) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(codeVerifier.getBytes());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }
}
