package com.bookclub.backend.config;

import com.bookclub.backend.user.User;
import org.bson.Document;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * MongoDB 커스텀 변환기 설정
 *
 * 문제: posts 필드가 빈 배열 []로 저장된 기존 데이터가 있음
 * 해결: 빈 배열을 null 또는 빈 UserPosts 객체로 변환
 */
@Configuration
public class MongoConverterConfig {

    @Bean
    public MongoCustomConversions customConversions() {
        return new MongoCustomConversions(Arrays.asList(
            new ArrayToUserPostsConverter(),
            new DocumentToUserPostsConverter()
        ));
    }

    /**
     * ArrayList (빈 배열 포함) → UserPosts 변환
     * MongoDB에 posts: [] 로 저장된 경우 처리
     */
    private static class ArrayToUserPostsConverter implements Converter<ArrayList<?>, User.UserPosts> {
        @Override
        public User.UserPosts convert(ArrayList<?> source) {
            // 빈 배열이거나 잘못된 배열인 경우 빈 UserPosts 반환
            return new User.UserPosts(new ArrayList<>(), new ArrayList<>());
        }
    }

    /**
     * Document → UserPosts 변환
     * MongoDB에 posts: { created: [...], participated: [...] } 로 저장된 경우 처리
     */
    private static class DocumentToUserPostsConverter implements Converter<Document, User.UserPosts> {
        @Override
        @SuppressWarnings("unchecked")
        public User.UserPosts convert(Document source) {
            if (source == null) {
                return new User.UserPosts(new ArrayList<>(), new ArrayList<>());
            }

            List<String> created = source.get("created", List.class);
            List<String> participated = source.get("participated", List.class);

            return new User.UserPosts(
                created != null ? new ArrayList<>(created) : new ArrayList<>(),
                participated != null ? new ArrayList<>(participated) : new ArrayList<>()
            );
        }
    }
}
