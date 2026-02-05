package com.bookclub.backend.recommendation.service;

import com.bookclub.backend.openai.OpenAiClient;
import com.bookclub.backend.openai.dto.OpenAiResponse;
import com.bookclub.backend.post.Post;
import com.bookclub.backend.post.PostRepository;
import com.bookclub.backend.recommendation.model.*;
import com.bookclub.backend.recommendation.repository.*;
import com.bookclub.backend.user.User;
import com.bookclub.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AI 추천 서비스 - 핵심 추천 파이프라인 구현
 */
@Service
@RequiredArgsConstructor
public class AIRecommendationService {

    private static final Logger logger = LoggerFactory.getLogger(AIRecommendationService.class);

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final AIRecommendationCacheRepository cacheRepository;
    private final AIRecommendationRunRepository runRepository;
    private final AIRecommendationFeedbackRepository feedbackRepository;
    private final AIRecommendationClickRepository clickRepository;
    private final BookSearchService bookSearchService;
    private final OpenAiClient openAiClient;

    private static final int MIN_RECOMMENDATIONS = 8;
    private static final int MAX_RECOMMENDATIONS = 12;
    private static final int CACHE_DAYS = 7;

    // ========== Public API ==========

    /**
     * 현재 추천 조회 (캐시 또는 새로 생성)
     */
    public AIRecommendationCache getRecommendations(String userId, String lang) {
        // 1. 캐시 확인
        Optional<AIRecommendationCache> cached = cacheRepository.findByUserIdAndStatus(userId, "active");

        if (cached.isPresent() && !cached.get().isExpired()) {
            logger.info("Returning cached recommendations for user {}", userId);
            return cached.get();
        }

        // 2. 캐시 없거나 만료됨 - 새로 생성
        logger.info("Cache miss for user {}, generating new recommendations", userId);
        return regenerateRecommendationsInternal(userId, "auto", lang);
    }

    /**
     * 추천 강제 재생성
     */
    public AIRecommendationCache regenerateRecommendations(String userId, String lang) {
        return regenerateRecommendationsInternal(userId, "manual", lang);
    }

    private AIRecommendationCache regenerateRecommendationsInternal(String userId, String triggerType, String lang) {
        AIRecommendationRun run = AIRecommendationRun.start(userId, triggerType);
        final String preferredLang = (lang != null && !lang.isEmpty()) ? lang : "en";

        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

            // Step 1: Seed ISBN 수집
            Set<String> seedIsbns = collectSeedIsbns(user);
            run.getStats().setSeedCount(seedIsbns.size());
            logger.info("Collected {} seed ISBNs for user {}", seedIsbns.size(), userId);

            if (seedIsbns.isEmpty()) {
                // Fallback: 인기 도서 추천
                return createFallbackRecommendations(user, run, preferredLang);
            }

            // Step 2: 후보 도서 검색
            List<BookSearchService.BookCandidate> candidates = searchCandidates(seedIsbns, user, preferredLang);
            run.getStats().setCandidatesFound(candidates.size());
            logger.info("Found {} candidate books", candidates.size());

            // Step 3: 이미 상호작용한 책 제외
            Set<String> excludedIsbns = collectExcludedIsbns(userId, seedIsbns);
            candidates = filterCandidates(candidates, excludedIsbns);
            run.getStats().setCandidatesAfterFilter(candidates.size());
            logger.info("After filtering: {} candidates", candidates.size());

            if (candidates.isEmpty()) {
                return createFallbackRecommendations(user, run, preferredLang);
            }

            // Step 4: 스코어링
            List<BookSearchService.BookCandidate> scored = scoreCandidates(candidates, seedIsbns, user);

            // Step 5: 다양성 고려해 선택
            List<BookSearchService.BookCandidate> selected = selectWithDiversity(scored, MIN_RECOMMENDATIONS, MAX_RECOMMENDATIONS);

            // Step 6: 추천 이유 생성
            List<AIRecommendationCache.RecommendedBook> recommendations = generateRecommendedBooks(selected, user, preferredLang);
            run.getStats().setFinalRecommendations(recommendations.size());
            run.getStats().setUsedLLM(openAiClient.isConfigured());
            run.getStats().setModelUsed(openAiClient.isConfigured() ? "gpt-4o-mini" : "rule-based");

            // Step 7: 캐시 저장
            int candidatesFound = run.getStats().getCandidatesFound();
            int candidatesAfterFilter = run.getStats().getCandidatesAfterFilter();
            AIRecommendationCache cache = saveCache(userId, recommendations, seedIsbns, excludedIsbns, user, preferredLang, candidatesFound, candidatesAfterFilter);

            // Step 8: User.fav.ai에 동기화 (하위 호환성)
            syncToUserFav(user, recommendations);

            // Run 완료
            run.complete("success");
            runRepository.save(run);

            logger.info("Successfully generated {} recommendations for user {}", recommendations.size(), userId);
            return cache;

        } catch (Exception e) {
            logger.error("Recommendation generation failed for user {}: {}", userId, e.getMessage(), e);
            run.fail(e.getMessage());
            runRepository.save(run);
            throw new RuntimeException("Failed to generate recommendations", e);
        }
    }

    /**
     * 피드백 기록
     */
    public AIRecommendationFeedback recordFeedback(String userId, String isbn, String feedbackType, String reason) {
        // 기존 피드백 확인 (덮어쓰기)
        Optional<AIRecommendationFeedback> existing = feedbackRepository.findByUserIdAndIsbn(userId, isbn);

        AIRecommendationFeedback feedback;
        if (existing.isPresent()) {
            feedback = existing.get();
            feedback.setFeedbackType(feedbackType);
            feedback.setReason(reason);
            feedback.setCreatedAt(LocalDateTime.now());
        } else {
            feedback = AIRecommendationFeedback.create(userId, isbn, feedbackType, reason, null);
        }

        feedback = feedbackRepository.save(feedback);

        // 캐시에서 피드백 상태 업데이트
        updateCacheFeedbackStatus(userId, isbn, feedbackType);

        logger.info("Recorded feedback for user {} on isbn {}: {}", userId, isbn, feedbackType);
        return feedback;
    }

    /**
     * 클릭 이벤트 기록
     */
    public AIRecommendationClick recordClick(String userId, String isbn, String actionType) {
        AIRecommendationClick click = AIRecommendationClick.create(userId, isbn, actionType, null);
        click = clickRepository.save(click);
        logger.debug("Recorded click for user {} on isbn {}: {}", userId, isbn, actionType);
        return click;
    }

    // ========== Private Methods - Seed Collection ==========

    private Set<String> collectSeedIsbns(User user) {
        Set<String> seeds = new HashSet<>();

        // 1. 좋아요한 책
        if (user.getFav() != null && user.getFav().getUser() != null) {
            user.getFav().getUser().forEach(fav -> {
                if (fav.getIsbn() != null && !fav.getIsbn().isEmpty()) {
                    seeds.add(fav.getIsbn());
                }
            });
        }

        // 2. 참여/생성한 Post의 책
        List<String> postIds = new ArrayList<>();
        if (user.getPosts() != null) {
            if (user.getPosts().getCreated() != null) {
                postIds.addAll(user.getPosts().getCreated());
            }
            if (user.getPosts().getParticipated() != null) {
                postIds.addAll(user.getPosts().getParticipated());
            }
        }

        if (!postIds.isEmpty()) {
            List<Post> posts = postRepository.findAllById(postIds);
            posts.stream()
                .filter(p -> p.getBookData() != null && p.getBookData().getIsbn() != null)
                .forEach(p -> seeds.add(p.getBookData().getIsbn()));
        }

        return seeds;
    }

    private Set<String> collectExcludedIsbns(String userId, Set<String> seedIsbns) {
        Set<String> excluded = new HashSet<>(seedIsbns);

        // dislike 피드백 받은 ISBN 추가
        List<AIRecommendationFeedback> dislikes = feedbackRepository.findByUserIdAndFeedbackType(userId, "dislike");
        dislikes.forEach(f -> excluded.add(f.getIsbn()));

        // dismiss 피드백 받은 ISBN 추가
        List<AIRecommendationFeedback> dismisses = feedbackRepository.findByUserIdAndFeedbackType(userId, "dismiss");
        dismisses.forEach(f -> excluded.add(f.getIsbn()));

        return excluded;
    }

    // ========== Private Methods - Candidate Search ==========

    private List<BookSearchService.BookCandidate> searchCandidates(Set<String> seedIsbns, User user, String preferredLang) {
        List<BookSearchService.BookCandidate> candidates = new ArrayList<>();

        // 전략 1: Seed 책들의 정보 조회 후 저자/장르 추출
        Map<String, BookSearchService.BookCandidate> seedBooks = bookSearchService.getBatchByIsbns(new ArrayList<>(seedIsbns));

        // 저자 기반 검색
        Set<String> authors = new HashSet<>();
        seedBooks.values().forEach(book -> {
            if (book.getAuthor() != null && !book.getAuthor().equals("Unknown Author")) {
                authors.add(book.getAuthor().split(",")[0].trim()); // 첫 번째 저자만
            }
        });

        for (String author : authors.stream().limit(3).collect(Collectors.toList())) {
            candidates.addAll(bookSearchService.searchByAuthor(author, preferredLang, 5));
        }

        // 장르 기반 검색
        Set<String> genres = new HashSet<>();
        seedBooks.values().forEach(book -> {
            if (book.getGenre() != null) {
                genres.add(book.getGenre());
            }
            if (book.getCategories() != null) {
                genres.addAll(book.getCategories());
            }
        });

        // 사용자 프로필의 선호 장르 추가
        if (user.getProfile() != null && user.getProfile().getIntroduce() != null) {
            List<String> preferredGenres = user.getProfile().getIntroduce().getPreferredGenre();
            if (preferredGenres != null) {
                genres.addAll(preferredGenres);
            }
        }

        for (String genre : genres.stream().limit(5).collect(Collectors.toList())) {
            candidates.addAll(bookSearchService.searchByGenre(genre, preferredLang, 5));
        }

        // 중복 제거
        Map<String, BookSearchService.BookCandidate> uniqueCandidates = new HashMap<>();
        for (BookSearchService.BookCandidate candidate : candidates) {
            if (candidate.getIsbn() != null && !uniqueCandidates.containsKey(candidate.getIsbn())) {
                uniqueCandidates.put(candidate.getIsbn(), candidate);
            }
        }

        return new ArrayList<>(uniqueCandidates.values());
    }

    private List<BookSearchService.BookCandidate> filterCandidates(
        List<BookSearchService.BookCandidate> candidates,
        Set<String> excludedIsbns
    ) {
        return candidates.stream()
            .filter(c -> c.getIsbn() != null && !excludedIsbns.contains(c.getIsbn()))
            .collect(Collectors.toList());
    }

    // ========== Private Methods - Scoring ==========

    private List<BookSearchService.BookCandidate> scoreCandidates(
        List<BookSearchService.BookCandidate> candidates,
        Set<String> seedIsbns,
        User user
    ) {
        // Seed 책들의 정보 가져오기
        Map<String, BookSearchService.BookCandidate> seedBooks = bookSearchService.getBatchByIsbns(new ArrayList<>(seedIsbns));

        // 참조 데이터 추출
        Set<String> seedGenres = new HashSet<>();
        Set<String> seedAuthors = new HashSet<>();
        Set<String> seedKeywords = new HashSet<>();

        seedBooks.values().forEach(book -> {
            if (book.getGenre() != null) seedGenres.add(book.getGenre().toLowerCase());
            if (book.getCategories() != null) {
                book.getCategories().forEach(c -> seedGenres.add(c.toLowerCase()));
            }
            if (book.getAuthor() != null) seedAuthors.add(book.getAuthor().toLowerCase());
            if (book.getTitle() != null) {
                Arrays.stream(book.getTitle().toLowerCase().split("\\s+"))
                    .filter(w -> w.length() > 3)
                    .forEach(seedKeywords::add);
            }
        });

        // 사용자 선호 장르 추가
        if (user.getProfile() != null && user.getProfile().getIntroduce() != null) {
            List<String> preferredGenres = user.getProfile().getIntroduce().getPreferredGenre();
            if (preferredGenres != null) {
                preferredGenres.forEach(g -> seedGenres.add(g.toLowerCase()));
            }
        }

        // 각 후보에 점수 부여
        for (BookSearchService.BookCandidate candidate : candidates) {
            AIRecommendationCache.ScoreBreakdown breakdown = new AIRecommendationCache.ScoreBreakdown();

            // 장르 점수 (40점 만점)
            double genreScore = calculateGenreScore(candidate, seedGenres);
            breakdown.setGenreScore(genreScore);

            // 저자 점수 (20점 만점)
            double authorScore = calculateAuthorScore(candidate, seedAuthors);
            breakdown.setAuthorScore(authorScore);

            // 키워드 점수 (15점 만점)
            double keywordScore = calculateKeywordScore(candidate, seedKeywords);
            breakdown.setKeywordScore(keywordScore);

            // 인기도 점수 (15점 만점) - 데이터 없으면 기본 5점
            double popularityScore = 5.0;
            breakdown.setPopularityScore(popularityScore);

            candidate.setScoreBreakdown(breakdown);
            candidate.setScore(breakdown.getTotal());
        }

        // 점수순 정렬
        candidates.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        return candidates;
    }

    private double calculateGenreScore(BookSearchService.BookCandidate candidate, Set<String> seedGenres) {
        if (seedGenres.isEmpty()) return 0;

        int matches = 0;
        String candidateGenre = candidate.getGenre() != null ? candidate.getGenre().toLowerCase() : "";
        List<String> candidateCategories = candidate.getCategories() != null
            ? candidate.getCategories().stream().map(String::toLowerCase).collect(Collectors.toList())
            : Collections.emptyList();

        for (String seedGenre : seedGenres) {
            if (candidateGenre.contains(seedGenre) || seedGenre.contains(candidateGenre)) {
                matches += 2;
            }
            for (String cat : candidateCategories) {
                if (cat.contains(seedGenre) || seedGenre.contains(cat)) {
                    matches++;
                }
            }
        }

        return Math.min(40, matches * 8);
    }

    private double calculateAuthorScore(BookSearchService.BookCandidate candidate, Set<String> seedAuthors) {
        if (seedAuthors.isEmpty() || candidate.getAuthor() == null) return 0;

        String candidateAuthor = candidate.getAuthor().toLowerCase();
        for (String seedAuthor : seedAuthors) {
            if (candidateAuthor.contains(seedAuthor) || seedAuthor.contains(candidateAuthor)) {
                return 20;
            }
        }
        return 0;
    }

    private double calculateKeywordScore(BookSearchService.BookCandidate candidate, Set<String> seedKeywords) {
        if (seedKeywords.isEmpty() || candidate.getTitle() == null) return 0;

        Set<String> titleWords = Arrays.stream(candidate.getTitle().toLowerCase().split("\\s+"))
            .filter(w -> w.length() > 3)
            .collect(Collectors.toSet());

        long matches = titleWords.stream().filter(seedKeywords::contains).count();
        return Math.min(15, matches * 5);
    }

    // ========== Private Methods - Selection ==========

    private List<BookSearchService.BookCandidate> selectWithDiversity(
        List<BookSearchService.BookCandidate> scored,
        int minCount,
        int maxCount
    ) {
        List<BookSearchService.BookCandidate> selected = new ArrayList<>();
        Set<String> selectedAuthors = new HashSet<>();
        Set<String> selectedGenres = new HashSet<>();

        for (BookSearchService.BookCandidate candidate : scored) {
            if (selected.size() >= maxCount) break;

            String author = candidate.getAuthor() != null ? candidate.getAuthor().toLowerCase() : "";
            String genre = candidate.getGenre() != null ? candidate.getGenre().toLowerCase() : "";

            // 다양성 페널티 적용
            int authorCount = (int) selectedAuthors.stream().filter(a -> a.equals(author)).count();
            int genreCount = (int) selectedGenres.stream().filter(g -> g.equals(genre)).count();

            if (authorCount >= 2) {
                // 같은 저자 2권 이상이면 스킵 (다양성)
                continue;
            }

            if (genreCount >= 3 && selected.size() >= minCount) {
                // 같은 장르 3권 이상이면 스킵 (다양성, 최소 개수 충족 시)
                continue;
            }

            selected.add(candidate);
            selectedAuthors.add(author);
            selectedGenres.add(genre);
        }

        return selected;
    }

    // ========== Private Methods - Reason Generation ==========

    private List<AIRecommendationCache.RecommendedBook> generateRecommendedBooks(
        List<BookSearchService.BookCandidate> candidates,
        User user,
        String preferredLang
    ) {
        List<AIRecommendationCache.RecommendedBook> recommendations = new ArrayList<>();
        String userContext = buildUserContext(user);

        for (BookSearchService.BookCandidate candidate : candidates) {
            AIRecommendationCache.RecommendedBook rec = new AIRecommendationCache.RecommendedBook();
            rec.setIsbn(candidate.getIsbn());
            rec.setTitle(candidate.getTitle());
            rec.setAuthor(candidate.getAuthor());
            rec.setCoverUrl(candidate.getCoverUrl());
            rec.setGenre(candidate.getGenre());
            rec.setScore(candidate.getScore());
            rec.setScoreBreakdown(candidate.getScoreBreakdown());
            rec.setLanguage(candidate.getLanguage());
            rec.setAddedAt(LocalDateTime.now());

            // 추천 이유 생성
            String reason = generateReason(candidate, userContext, preferredLang);
            rec.setReason(reason);

            recommendations.add(rec);
        }

        return recommendations;
    }

    private String generateReason(BookSearchService.BookCandidate book, String userContext, String preferredLang) {
        // LLM 사용 가능하면 LLM으로 생성
        if (openAiClient.isConfigured()) {
            try {
                String reason = generateLLMReason(book, userContext, preferredLang);
                if (reason != null && !reason.isEmpty()) {
                    return reason;
                }
            } catch (Exception e) {
                logger.warn("LLM reason generation failed, using rule-based: {}", e.getMessage());
            }
        }

        // Fallback: 룰 기반 이유 생성
        return generateRuleBasedReason(book, preferredLang);
    }

    private String generateLLMReason(BookSearchService.BookCandidate book, String userContext, String preferredLang) {
        boolean isKorean = "ko".equals(preferredLang);

        String systemPrompt = isKorean
            ? "당신은 독서 추천 도우미입니다. 사용자의 독서 취향을 바탕으로 왜 이 책이 추천되었는지 1-2문장으로 설명해주세요. 마크다운 없이 간결하게 작성하세요."
            : "You are a book recommendation assistant. Explain in 1-2 sentences why this book is recommended based on the user's reading preferences. Be concise, no markdown.";

        String userPrompt = String.format(
            "User context: %s\n\nRecommended book: \"%s\" by %s (Genre: %s)\n\nGenerate a personalized recommendation reason.",
            userContext,
            book.getTitle(),
            book.getAuthor(),
            book.getGenre() != null ? book.getGenre() : "Unknown"
        );

        OpenAiResponse response = openAiClient.getChatCompletion(systemPrompt, userPrompt, 100);
        if (response != null && response.getContent() != null) {
            return response.getContent().trim();
        }
        return null;
    }

    private String generateRuleBasedReason(BookSearchService.BookCandidate book, String preferredLang) {
        boolean isKorean = "ko".equals(preferredLang);
        AIRecommendationCache.ScoreBreakdown scores = book.getScoreBreakdown();

        if (scores != null) {
            if (scores.getAuthorScore() >= 15) {
                return isKorean
                    ? "좋아하시는 작가의 다른 작품입니다."
                    : "Another work by an author you enjoy.";
            }
            if (scores.getGenreScore() >= 30) {
                return isKorean
                    ? "선호하시는 장르의 인기 도서입니다."
                    : "A popular book in your preferred genre.";
            }
            if (scores.getKeywordScore() >= 10) {
                return isKorean
                    ? "관심사와 관련된 도서입니다."
                    : "Related to your interests.";
            }
        }

        return isKorean
            ? "회원님의 독서 취향에 맞는 추천입니다."
            : "Recommended based on your reading preferences.";
    }

    private String buildUserContext(User user) {
        StringBuilder context = new StringBuilder();

        // 좋아요한 책 정보
        if (user.getFav() != null && user.getFav().getUser() != null && !user.getFav().getUser().isEmpty()) {
            int likedCount = user.getFav().getUser().size();
            context.append(String.format("Liked %d books. ", likedCount));
        }

        // 선호 장르
        if (user.getProfile() != null && user.getProfile().getIntroduce() != null) {
            List<String> genres = user.getProfile().getIntroduce().getPreferredGenre();
            if (genres != null && !genres.isEmpty()) {
                context.append("Preferred genres: ").append(String.join(", ", genres)).append(". ");
            }
        }

        // 참여한 토론 수
        if (user.getPosts() != null) {
            int totalPosts = 0;
            if (user.getPosts().getCreated() != null) totalPosts += user.getPosts().getCreated().size();
            if (user.getPosts().getParticipated() != null) totalPosts += user.getPosts().getParticipated().size();
            if (totalPosts > 0) {
                context.append(String.format("Participated in %d book discussions.", totalPosts));
            }
        }

        return context.length() > 0 ? context.toString() : "New user with limited reading history.";
    }

    // ========== Private Methods - Storage ==========

    private AIRecommendationCache saveCache(
        String userId,
        List<AIRecommendationCache.RecommendedBook> recommendations,
        Set<String> seedIsbns,
        Set<String> excludedIsbns,
        User user,
        String preferredLang,
        int candidatesSearched,
        int candidatesAfterFilter
    ) {
        // 기존 active 캐시 비활성화
        cacheRepository.findByUserIdAndStatus(userId, "active").ifPresent(existing -> {
            existing.setStatus("expired");
            cacheRepository.save(existing);
        });

        // 새 캐시 생성
        AIRecommendationCache.GenerationContext context = new AIRecommendationCache.GenerationContext();
        context.setSeedIsbns(new ArrayList<>(seedIsbns));
        context.setExcludedIsbns(new ArrayList<>(excludedIsbns));
        context.setPreferredLanguage(preferredLang);
        context.setCandidatesSearched(candidatesSearched);
        context.setCandidatesAfterFilter(candidatesAfterFilter);

        if (user.getProfile() != null && user.getProfile().getIntroduce() != null) {
            List<String> genres = user.getProfile().getIntroduce().getPreferredGenre();
            if (genres != null) {
                context.setPreferredGenres(genres);
            }
        }

        AIRecommendationCache cache = AIRecommendationCache.create(userId, recommendations, context);
        return cacheRepository.save(cache);
    }

    private void syncToUserFav(User user, List<AIRecommendationCache.RecommendedBook> recommendations) {
        // 기존 AI 추천 삭제
        user.getFav().getAi().clear();

        // 새 추천 추가
        for (AIRecommendationCache.RecommendedBook rec : recommendations) {
            User.AIRecommendation aiRec = new User.AIRecommendation(rec.getIsbn(), rec.getReason());
            user.getFav().getAi().add(aiRec);
        }

        userRepository.save(user);
    }

    private void updateCacheFeedbackStatus(String userId, String isbn, String feedbackStatus) {
        cacheRepository.findByUserIdAndStatus(userId, "active").ifPresent(cache -> {
            cache.getItems().stream()
                .filter(item -> isbn.equals(item.getIsbn()))
                .findFirst()
                .ifPresent(item -> item.setFeedbackStatus(feedbackStatus));
            cacheRepository.save(cache);
        });
    }

    // ========== Private Methods - Fallback ==========

    private AIRecommendationCache createFallbackRecommendations(User user, AIRecommendationRun run, String preferredLang) {
        logger.info("Creating fallback recommendations for user {}", user.getId());

        // 인기 검색어로 검색
        List<String> popularKeywords = preferredLang.equals("ko")
            ? Arrays.asList("베스트셀러", "인기", "추천")
            : Arrays.asList("bestseller", "popular", "recommended");

        List<BookSearchService.BookCandidate> candidates = new ArrayList<>();
        for (String keyword : popularKeywords) {
            candidates.addAll(bookSearchService.searchByKeyword(keyword, preferredLang, 5));
        }

        // 중복 제거 및 필터
        Map<String, BookSearchService.BookCandidate> uniqueCandidates = new HashMap<>();
        for (BookSearchService.BookCandidate candidate : candidates) {
            if (candidate.getIsbn() != null && !uniqueCandidates.containsKey(candidate.getIsbn())) {
                uniqueCandidates.put(candidate.getIsbn(), candidate);
            }
        }

        List<BookSearchService.BookCandidate> selected = new ArrayList<>(uniqueCandidates.values())
            .stream()
            .limit(MAX_RECOMMENDATIONS)
            .collect(Collectors.toList());

        // 추천 이유는 기본 메시지
        List<AIRecommendationCache.RecommendedBook> recommendations = selected.stream()
            .map(candidate -> {
                AIRecommendationCache.RecommendedBook rec = new AIRecommendationCache.RecommendedBook();
                rec.setIsbn(candidate.getIsbn());
                rec.setTitle(candidate.getTitle());
                rec.setAuthor(candidate.getAuthor());
                rec.setCoverUrl(candidate.getCoverUrl());
                rec.setGenre(candidate.getGenre());
                rec.setAddedAt(LocalDateTime.now());
                rec.setReason(preferredLang.equals("ko")
                    ? "인기 도서입니다. 책을 좋아요하면 더 정확한 추천을 받을 수 있습니다."
                    : "A popular book. Like more books to get personalized recommendations.");
                return rec;
            })
            .collect(Collectors.toList());

        run.getStats().setFinalRecommendations(recommendations.size());
        run.getStats().setModelUsed("fallback");
        run.complete("partial");
        runRepository.save(run);

        AIRecommendationCache.GenerationContext context = new AIRecommendationCache.GenerationContext();
        context.setPreferredLanguage(preferredLang);

        AIRecommendationCache cache = AIRecommendationCache.create(user.getId(), recommendations, context);
        cache = cacheRepository.save(cache);

        syncToUserFav(user, recommendations);

        return cache;
    }

    // ========== Private Methods - Helpers ==========

    private String determinePreferredLanguage(User user) {
        // 사용자 프로필에서 언어 확인
        // 기본값은 "en"
        return "en";
    }
}
