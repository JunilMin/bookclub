package com.bookclub.backend.recommendation.service;

import com.bookclub.backend.ISBNAPI.GoogleBooksService;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 도서 검색 서비스 - Google Books API 래퍼
 * AI 추천 시스템에서 후보 도서를 검색하는 데 사용
 */
@Service
@RequiredArgsConstructor
public class BookSearchService {

    private static final Logger logger = LoggerFactory.getLogger(BookSearchService.class);

    private final GoogleBooksService googleBooksService;

    /**
     * 저자로 도서 검색
     */
    public List<BookCandidate> searchByAuthor(String author, String lang, int limit) {
        try {
            String query = "inauthor:" + author;
            return searchAndConvert(query, lang, limit);
        } catch (Exception e) {
            logger.warn("Author search failed for '{}': {}", author, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 장르/카테고리로 도서 검색
     */
    public List<BookCandidate> searchByGenre(String genre, String lang, int limit) {
        try {
            String query = "subject:" + genre;
            return searchAndConvert(query, lang, limit);
        } catch (Exception e) {
            logger.warn("Genre search failed for '{}': {}", genre, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 키워드로 도서 검색
     */
    public List<BookCandidate> searchByKeyword(String keyword, String lang, int limit) {
        try {
            return searchAndConvert(keyword, lang, limit);
        } catch (Exception e) {
            logger.warn("Keyword search failed for '{}': {}", keyword, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * ISBN으로 단일 도서 조회
     */
    public Optional<BookCandidate> getByIsbn(String isbn) {
        try {
            String query = "isbn:" + isbn;
            List<BookCandidate> results = searchAndConvert(query, null, 1);
            return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
        } catch (Exception e) {
            logger.warn("ISBN lookup failed for '{}': {}", isbn, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 여러 ISBN으로 도서 정보 일괄 조회
     */
    public Map<String, BookCandidate> getBatchByIsbns(List<String> isbns) {
        Map<String, BookCandidate> results = new HashMap<>();
        for (String isbn : isbns) {
            getByIsbn(isbn).ifPresent(book -> results.put(isbn, book));
        }
        return results;
    }

    // ========== Private Methods ==========

    private List<BookCandidate> searchAndConvert(String query, String lang, int limit) throws Exception {
        List<Map<String, Object>> rawResults = googleBooksService.searchBooks(query, lang);

        return rawResults.stream()
            .limit(limit)
            .map(this::mapToCandidate)
            .filter(Objects::nonNull)
            .filter(c -> c.getIsbn() != null && !c.getIsbn().isEmpty())
            .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private BookCandidate mapToCandidate(Map<String, Object> book) {
        try {
            BookCandidate candidate = new BookCandidate();

            candidate.setIsbn((String) book.get("isbn"));
            candidate.setTitle((String) book.getOrDefault("title", "Unknown Title"));
            candidate.setAuthor((String) book.getOrDefault("author", "Unknown Author"));
            candidate.setDescription((String) book.get("description"));
            candidate.setPublisher((String) book.get("publisher"));
            candidate.setPublishedDate((String) book.get("publishedDate"));

            // Cover URL 추출
            Object thumbnailObj = book.get("thumbnail");
            if (thumbnailObj instanceof Map) {
                Map<String, String> thumbnail = (Map<String, String>) thumbnailObj;
                candidate.setCoverUrl(thumbnail.getOrDefault("small", thumbnail.get("medium")));
            }

            // Categories 추출
            Object categoriesObj = book.get("categories");
            if (categoriesObj instanceof List) {
                List<String> categories = (List<String>) categoriesObj;
                candidate.setCategories(categories);
                if (!categories.isEmpty()) {
                    candidate.setGenre(categories.get(0));
                }
            }

            return candidate;
        } catch (Exception e) {
            logger.warn("Failed to map book candidate: {}", e.getMessage());
            return null;
        }
    }

    // ========== Inner Class ==========

    @Getter
    @Setter
    @NoArgsConstructor
    public static class BookCandidate {
        private String isbn;
        private String title;
        private String author;
        private String coverUrl;
        private String genre;
        private List<String> categories = new ArrayList<>();
        private String description;
        private String publisher;
        private String publishedDate;
        private String language;

        // Scoring fields (set during scoring phase)
        private double score;
        private com.bookclub.backend.recommendation.model.AIRecommendationCache.ScoreBreakdown scoreBreakdown;
    }
}
