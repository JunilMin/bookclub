# Favorites 페이지 최적화 계획

## 현재 상태 분석

### 파일 구조
- `frontend/src/screens/Favorites.tsx` - 메인 페이지 컴포넌트 (517 lines)
- `frontend/src/screens/styles/Favorites.css` - 스타일 (1017 lines)
- `frontend/src/api/favorites.ts` - API 호출 함수

### 현재 문제점

#### 1. 전체 페이지 블로킹 로딩
```tsx
// 현재: API 완료 전까지 전체 페이지가 스피너로 대체됨
if (loading) {
  return (
    <div className="favorites-loading">
      <div className="favorites-loading-spinner"></div>
      <p>{t('loading')}</p>
    </div>
  );
}
```
- Hero 섹션 통계가 로딩 중 0/0/0으로 표시됨
- Skeleton UI 없이 단순 스피너만 표시

#### 2. N+1 API 문제
```tsx
// 현재: 각 책마다 개별 API 호출 (느림)
const enrichedUserFavs = await Promise.all(
  (fav.user || []).map(async (f) => {
    const bookInfo = await getBookByISBN(f.isbn);  // N번 호출
    return { ...f, bookInfo: bookInfo || undefined };
  })
);
```
- 즐겨찾기 1회 + 책 정보 N회 = N+1 API 호출
- 캐싱 없음 - 매 방문 시 재요청

#### 3. 상태 관리 부재
```tsx
// 현재: 로컬 useState만 사용
const [userFavorites, setUserFavorites] = useState<EnrichedFavorite[]>([]);
const [aiRecommendations, setAiRecommendations] = useState<EnrichedAIRecommendation[]>([]);
```
- 페이지 이동 시 상태 유실
- 캐싱 없음

#### 4. 메모이제이션 부재
```tsx
// 현재: 매 렌더마다 재생성
const formatDate = (dateString: string) => { ... };
const currentItems = activeTab === 'liked' ? userFavorites : aiRecommendations;
const isBookInFavorites = (isbn: string | undefined) => { ... };
```

#### 5. 미사용 변수
```tsx
const totalCount = activeTab === 'liked' ? userFavorites.length : aiRecommendations.length;
// totalCount는 선언만 되고 사용되지 않음 (TypeScript 경고)
```

---

## 최적화 전략

### Phase 1: Skeleton UI 컴포넌트 생성

**파일**: `frontend/src/components/favorites/FavoritesSkeletons.tsx`

```tsx
// Hero Stats Skeleton
export const HeroStatsSkeleton: React.FC = () => (
  <div className="favorites-hero-stats">
    {[1, 2, 3].map(i => (
      <div key={i} className="favorites-stat-item">
        <div className="favorites-skeleton favorites-skeleton-stat-icon" />
        <div className="favorites-stat-info">
          <div className="favorites-skeleton favorites-skeleton-stat-value" />
          <div className="favorites-skeleton favorites-skeleton-stat-label" />
        </div>
      </div>
    ))}
  </div>
);

// Book Card Skeleton
export const BookCardSkeleton: React.FC = () => (
  <div className="favorites-card">
    <div className="favorites-skeleton favorites-skeleton-cover" />
    <div className="favorites-card-content">
      <div className="favorites-skeleton favorites-skeleton-title" />
      <div className="favorites-skeleton favorites-skeleton-author" />
      <div className="favorites-skeleton favorites-skeleton-info" />
      <div className="favorites-card-actions">
        <div className="favorites-skeleton favorites-skeleton-btn" />
        <div className="favorites-skeleton favorites-skeleton-btn" />
      </div>
    </div>
  </div>
);

// Grid Skeleton (4 cards)
export const GridSkeleton: React.FC = () => (
  <div className="favorites-grid">
    {[1, 2, 3, 4].map(i => <BookCardSkeleton key={i} />)}
  </div>
);
```

**파일**: `frontend/src/components/favorites/FavoritesSkeletons.css`
- shimmer 애니메이션
- 각 skeleton 요소 크기 정의

---

### Phase 2: Zustand Store 생성

**파일**: `frontend/src/store/favoritesStore.ts`

```tsx
interface FavoritesState {
  // Data
  userFavorites: EnrichedFavorite[];
  aiRecommendations: EnrichedAIRecommendation[];

  // Loading states
  isLoading: boolean;
  isEnriching: boolean;  // 책 정보 로딩 중

  // Cache
  lastFetchTime: number | null;

  // Actions
  fetchFavorites: (forceRefresh?: boolean) => Promise<void>;
  addFavorite: (favorite: EnrichedFavorite) => void;
  removeFavorite: (isbn: string) => void;
  invalidateCache: () => void;
  reset: () => void;
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5분

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  userFavorites: [],
  aiRecommendations: [],
  isLoading: false,
  isEnriching: false,
  lastFetchTime: null,

  fetchFavorites: async (forceRefresh = false) => {
    const state = get();

    // 캐시 유효성 검사
    if (!forceRefresh && state.lastFetchTime &&
        Date.now() - state.lastFetchTime < CACHE_DURATION_MS) {
      return;
    }

    if (state.isLoading) return;

    set({ isLoading: true });

    try {
      const fav = await getMyFav();

      // Phase 1: 기본 데이터 먼저 표시 (빠른 렌더링)
      set({
        userFavorites: fav.user.map(f => ({ ...f })),
        aiRecommendations: fav.ai.map(r => ({ ...r })),
        isLoading: false,
        isEnriching: true,
        lastFetchTime: Date.now(),
      });

      // Phase 2: 책 정보 enrichment (백그라운드)
      const enrichedUser = await Promise.all(
        fav.user.map(async (f) => {
          const bookInfo = await getBookByISBN(f.isbn);
          return { ...f, bookInfo: bookInfo || undefined };
        })
      );

      const enrichedAI = await Promise.all(
        fav.ai.map(async (r) => {
          const bookInfo = await getBookByISBN(r.isbn);
          return { ...r, bookInfo: bookInfo || undefined };
        })
      );

      set({
        userFavorites: enrichedUser,
        aiRecommendations: enrichedAI,
        isEnriching: false,
      });

    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      set({ isLoading: false, isEnriching: false });
    }
  },

  addFavorite: (favorite) => {
    set(state => ({
      userFavorites: [...state.userFavorites, favorite]
    }));
  },

  removeFavorite: (isbn) => {
    set(state => ({
      userFavorites: state.userFavorites.filter(f => f.isbn !== isbn)
    }));
  },

  invalidateCache: () => set({ lastFetchTime: null }),

  reset: () => set({
    userFavorites: [],
    aiRecommendations: [],
    isLoading: false,
    isEnriching: false,
    lastFetchTime: null,
  }),
}));
```

---

### Phase 3: Favorites.tsx 리팩토링

#### 3.1 즉시 렌더링 Hero 섹션

```tsx
const Favorites: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  // Store
  const {
    userFavorites,
    aiRecommendations,
    isLoading,
    isEnriching,
    fetchFavorites,
  } = useFavoritesStore();

  // Fetch on mount
  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user, fetchFavorites]);

  // 로그인 안된 경우만 early return
  if (!user) {
    return <LoginRequired />;
  }

  // Hero는 항상 즉시 렌더링 (stats는 store에서)
  return (
    <div className="favorites-page">
      <HeroSection
        aiCount={aiRecommendations.length}
        likedCount={userFavorites.length}
        isLoading={isLoading}
      />
      <FilterBar ... />
      <MainContent
        isLoading={isLoading}
        isEnriching={isEnriching}
        ...
      />
    </div>
  );
};
```

#### 3.2 Progressive Loading

```tsx
// Hero에서 로딩 중이면 skeleton 표시
{isLoading ? (
  <HeroStatsSkeleton />
) : (
  <HeroStats ai={aiCount} liked={likedCount} total={aiCount + likedCount} />
)}

// Grid에서 로딩 중이면 skeleton 표시
{isLoading ? (
  <GridSkeleton />
) : currentItems.length === 0 ? (
  <EmptyState />
) : (
  <FavoritesGrid items={currentItems} isEnriching={isEnriching} />
)}
```

#### 3.3 Heavy Memoization

```tsx
// 공유 유틸리티 사용
import { formatDateFull } from '../utils/dateUtils';

const locale = useMemo(() =>
  (i18n.language === 'ko' ? 'ko' : 'en') as 'ko' | 'en',
  [i18n.language]
);

// 날짜 포맷 함수 메모이제이션
const formatDate = useCallback(
  (dateString: string) => formatDateFull(dateString, locale),
  [locale]
);

// 현재 아이템 메모이제이션
const currentItems = useMemo(() =>
  activeTab === 'liked' ? userFavorites : aiRecommendations,
  [activeTab, userFavorites, aiRecommendations]
);

// 즐겨찾기 체크 함수 메모이제이션
const favoriteIsbnSet = useMemo(() =>
  new Set(userFavorites.map(f => f.isbn)),
  [userFavorites]
);

const isBookInFavorites = useCallback(
  (isbn: string | undefined) => isbn ? favoriteIsbnSet.has(isbn) : false,
  [favoriteIsbnSet]
);

// 이벤트 핸들러 메모이제이션
const handleRemoveFavorite = useCallback(async (isbn: string) => {
  // ...
}, []);

const handleCreateDiscussion = useCallback((isbn: string) => {
  navigate(`/create?isbn=${encodeURIComponent(isbn)}`);
}, [navigate]);
```

---

### Phase 4: 미사용 변수 정리

```tsx
// 삭제 또는 사용
const totalCount = ...;  // 사용되지 않음 - 삭제
```

---

## 구현 체크리스트

### Task 1: FavoritesSkeletons 컴포넌트 생성
- [ ] `frontend/src/components/favorites/FavoritesSkeletons.tsx` 생성
- [ ] `frontend/src/components/favorites/FavoritesSkeletons.css` 생성
- [ ] HeroStatsSkeleton, BookCardSkeleton, GridSkeleton 구현

### Task 2: favoritesStore 생성
- [ ] `frontend/src/store/favoritesStore.ts` 생성
- [ ] 2단계 로딩 구현 (기본 데이터 → 책 정보 enrichment)
- [ ] 5분 캐싱 구현

### Task 3: Favorites.tsx 리팩토링
- [ ] Store 연동
- [ ] 즉시 렌더링 Hero 구현
- [ ] Skeleton UI 적용
- [ ] useMemo/useCallback 적용
- [ ] 공유 유틸리티 사용 (formatDateFull)
- [ ] 미사용 변수 정리 (totalCount)

### Task 4: TypeScript 검증
- [ ] `npx tsc --noEmit` 통과 확인

---

## 예상 결과

| 항목 | Before | After |
|------|--------|-------|
| 초기 렌더링 | 전체 블로킹 | Hero 즉시 표시 |
| 로딩 UX | 스피너만 | Skeleton UI |
| 페이지 재방문 | 매번 API 호출 | 5분 캐시 |
| 책 정보 로딩 | 블로킹 | Progressive (기본 → 상세) |
| 렌더링 최적화 | 없음 | Heavy Memoization |

---

## 파일 변경 요약

### 신규 파일
1. `frontend/src/components/favorites/FavoritesSkeletons.tsx`
2. `frontend/src/components/favorites/FavoritesSkeletons.css`
3. `frontend/src/store/favoritesStore.ts`

### 수정 파일
1. `frontend/src/screens/Favorites.tsx` - 전면 리팩토링
