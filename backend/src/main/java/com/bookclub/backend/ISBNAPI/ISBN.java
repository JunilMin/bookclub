package com.bookclub.backend.ISBNAPI;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class ISBN {
    private String title;
    private String author;

    public ISBN(String title, String author) {
        this.title = title;
        this.author = author;
    }
}
