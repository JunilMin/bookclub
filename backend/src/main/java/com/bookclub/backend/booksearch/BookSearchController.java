package com.bookclub.backend.booksearch;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class BookSearchController {
    private final BookSearchService bookSearchService = new BookSearchService();

    @GetMapping("/api/booksearch")
    public List<Book> searchBooks(@RequestParam String bynameorauthor) {
        try {
            return bookSearchService.searchBooks(bynameorauthor);
        } catch (Exception e) {
            e.printStackTrace();
            return List.of();
        }
    }
}
