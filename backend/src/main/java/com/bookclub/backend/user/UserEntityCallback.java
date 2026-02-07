package com.bookclub.backend.user;

import org.bson.Document;
import org.springframework.data.mongodb.core.mapping.event.AfterConvertCallback;
import org.springframework.stereotype.Component;

/**
 * MongoDB 콜백: User 객체가 로드된 후 legacy 필드 마이그레이션 수행
 *
 * 기존 데이터:
 *   - createdBookMeetings: List<String>
 *   - participatedBookMeetings: List<String>
 *
 * 새 구조:
 *   - posts.created: List<String>
 *   - posts.participated: List<String>
 */
@Component
public class UserEntityCallback implements AfterConvertCallback<User> {

    @Override
    public User onAfterConvert(User user, Document document, String collection) {
        // MongoDB에서 User 객체로 변환된 후 자동으로 legacy 필드 마이그레이션 수행
        // getPosts()를 호출하면 내부에서 자동 변환 로직이 실행됨
        user.getPosts();
        return user;
    }
}
