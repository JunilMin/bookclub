package com.bookclub.backend.ISBNAPI;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

public class ISBNSearchService {
    private static final String BASE_URL = "https://openlibrary.org/search.json";
    private final HttpClient client;
    private final ObjectMapper mapper;

    public ISBNSearchService() {
        this.client = HttpClient.newHttpClient();
        this.mapper = new ObjectMapper();
    }

    public List<ISBN> searchISBN(String input) throws Exception {
        // 검색어 인코딩 (공백을 +로 처리)
        String encodedQuery = URLEncoder.encode(input, StandardCharsets.UTF_8);
        String url = BASE_URL + "?q=" + encodedQuery;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return parseISBNSearchResponse(response.body());
    }

    private List<ISBN> parseISBNSearchResponse(String jsonResponse) {
        List<ISBN> books = new ArrayList<>();
        try {
            JsonNode rootNode = mapper.readTree(jsonResponse);
            for (JsonNode bookNode : rootNode.path("docs")) {
                String title = bookNode.path("title").asText();
                String author = bookNode.path("author_name").isArray()
                        ? bookNode.path("author_name").get(0).asText()
                        : "Unknown Author";
                books.add(new ISBN(title, author));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return books;
    }
}
