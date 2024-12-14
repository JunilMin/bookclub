package com.bookclub.backend.ISBNAPI;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/ISBN")
public class ISBNSearchController {
    private final ISBNSearchService ISBNSearchService = new ISBNSearchService();

    @GetMapping("/search")
    public Object searchISBN(@RequestParam String query) {
        try {
            List<ISBN> books = ISBNSearchService.searchISBN(query);
            if (books.isEmpty()) {
                return "검색 결과가 없습니다.";
            }
            return books; // 결과가 있을 때는 리스트 반환
        } catch (Exception e) {
            e.printStackTrace();
            return "오류 발생: " + e.getMessage();
        }
    }
}
