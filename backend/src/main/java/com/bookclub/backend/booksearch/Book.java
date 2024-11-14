package com.bookclub.backend.booksearch;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class Book {
    private String title;
    private String author;

    public Book(String title, String author) {
        this.title = title;
        this.author = author;
    }
}