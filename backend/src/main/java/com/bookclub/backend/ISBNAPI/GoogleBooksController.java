package com.bookclub.backend.ISBNAPI;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/books")
public class GoogleBooksController {

    @Autowired
    private GoogleBooksService googleBooksService;

    @GetMapping("/search")
    public ResponseEntity<?> searchBooks(
            @RequestParam String query,
            @RequestParam(required = false) String lang
    ) {
        try {
            List<Map<String, Object>> books = googleBooksService.searchBooks(query, lang);
            return ResponseEntity.ok(books);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Search failed: " + e.getMessage()));
        }
    }
}
