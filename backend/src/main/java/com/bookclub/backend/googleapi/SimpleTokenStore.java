package com.bookclub.backend.googleapi;


import com.google.auth.oauth2.TokenStore;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class SimpleTokenStore implements TokenStore {

    private final Path tokenPath = Paths.get("tokens", "google_token.json");

    public SimpleTokenStore() throws IOException {
        if (!Files.exists(tokenPath.getParent())) {
            Files.createDirectories(tokenPath.getParent());
        }
    }

    @Override
    public String load(String userId) throws IOException {
        if (!Files.exists(tokenPath)) {
            return null;
        }
        return Files.readString(tokenPath);
    }

    @Override
    public void store(String userId, String token) throws IOException {
        Files.writeString(tokenPath, token);
    }

    @Override
    public void delete(String userId) throws IOException {
        if (Files.exists(tokenPath)) {
            Files.delete(tokenPath);
        }
    }
}
