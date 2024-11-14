package com.bookclub.backend.booksearch;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

public class BookSearchService {
    private static final String BASE_URL = "https://openlibrary.org/search.json";
    private final HttpClient client;
    private final ObjectMapper mapper;

    public BookSearchService() {
        this.client = HttpClient.newHttpClient();
        this.mapper = new ObjectMapper();
    }

    public List<Book> searchBooks(String query) throws Exception {
        String url = BASE_URL + "?q=" + query;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return parseBookSearchResponse(response.body());
    }

    private List<Book> parseBookSearchResponse(String jsonResponse) {
        List<Book> books = new ArrayList<>();
        try {
            JsonNode rootNode = mapper.readTree(jsonResponse);
            for (JsonNode bookNode : rootNode.path("docs")) {
                String title = bookNode.path("title").asText();
                String author = bookNode.path("author_name").isArray()
                        ? bookNode.path("author_name").get(0).asText()
                        : "Unknown Author";
                books.add(new Book(title, author));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return books;
    }
}
