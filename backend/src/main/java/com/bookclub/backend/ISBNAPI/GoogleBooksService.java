package com.bookclub.backend.ISBNAPI;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GoogleBooksService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GoogleBooksService.class);

    @Value("${google.api.key}")
    private String apiKey;

    private final HttpClient client;
    private final ObjectMapper mapper;

    public GoogleBooksService() {
        this.client = HttpClient.newHttpClient();
        this.mapper = new ObjectMapper();
    }

    public List<Map<String, Object>> searchBooks(String query, String langRestrict) throws Exception {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);

        StringBuilder urlBuilder = new StringBuilder("https://www.googleapis.com/books/v1/volumes?");
        urlBuilder.append("q=").append(encodedQuery);
        urlBuilder.append("&maxResults=10");
        urlBuilder.append("&key=").append(apiKey);

        if (langRestrict != null && !langRestrict.isEmpty()) {
            urlBuilder.append("&langRestrict=").append(langRestrict);
        }

        // 디버깅: API 키 마스킹 로그
        String maskedKey = apiKey != null && apiKey.length() > 8
            ? apiKey.substring(0, 8) + "..."
            : "NULL_OR_SHORT";
        log.info("=== Google Books API 호출 ===");
        log.info("Query: {}, Lang: {}, API Key: {}", query, langRestrict, maskedKey);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(urlBuilder.toString()))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        // 디버깅: 응답 상태 및 내용 로그
        log.info("Response Status: {}", response.statusCode());
        if (response.statusCode() != 200) {
            log.error("Google Books API Error Response: {}", response.body());
            throw new RuntimeException("Google Books API error: " + response.statusCode() + " - " + response.body());
        }

        // 전체 응답을 콘솔에 출력
        System.out.println("=== Google Books API 전체 응답 ===");
        System.out.println(response.body());
        System.out.println("=== 응답 끝 ===");

        return parseResponse(response.body());
    }

    private List<Map<String, Object>> parseResponse(String jsonResponse) throws Exception {
        List<Map<String, Object>> books = new ArrayList<>();
        JsonNode rootNode = mapper.readTree(jsonResponse);
        JsonNode items = rootNode.path("items");

        if (items.isMissingNode() || !items.isArray()) {
            return books;
        }

        for (JsonNode item : items) {
            JsonNode volumeInfo = item.path("volumeInfo");
            Map<String, Object> book = new HashMap<>();

            book.put("title", volumeInfo.path("title").asText("Unknown Title"));

            // Authors
            JsonNode authors = volumeInfo.path("authors");
            if (authors.isArray() && authors.size() > 0) {
                StringBuilder authorStr = new StringBuilder();
                for (int i = 0; i < authors.size(); i++) {
                    if (i > 0) authorStr.append(", ");
                    authorStr.append(authors.get(i).asText());
                }
                book.put("author", authorStr.toString());
            } else {
                book.put("author", "Unknown Author");
            }

            // Thumbnail
            JsonNode imageLinks = volumeInfo.path("imageLinks");
            if (!imageLinks.isMissingNode()) {
                Map<String, String> thumbnail = new HashMap<>();
                String thumbUrl = imageLinks.path("thumbnail").asText(
                        imageLinks.path("smallThumbnail").asText(null)
                );
                if (thumbUrl != null) {
                    // Convert http to https
                    if (thumbUrl.startsWith("http:")) {
                        thumbUrl = thumbUrl.replace("http:", "https:");
                    }
                    thumbnail.put("small", thumbUrl);
                    thumbnail.put("medium", thumbUrl.replaceAll("zoom=\\d", "zoom=3"));
                }
                book.put("thumbnail", thumbnail);
            }

            book.put("publisher", volumeInfo.path("publisher").asText(null));
            book.put("publishedDate", volumeInfo.path("publishedDate").asText(null));
            book.put("description", volumeInfo.path("description").asText(null));

            // ISBN
            JsonNode identifiers = volumeInfo.path("industryIdentifiers");
            if (identifiers.isArray() && identifiers.size() > 0) {
                book.put("isbn", identifiers.get(0).path("identifier").asText(null));
            }

            // Categories
            JsonNode categories = volumeInfo.path("categories");
            if (categories.isArray()) {
                List<String> categoryList = new ArrayList<>();
                for (JsonNode cat : categories) {
                    categoryList.add(cat.asText());
                }
                book.put("categories", categoryList);
            }

            books.add(book);
        }

        return books;
    }
}
