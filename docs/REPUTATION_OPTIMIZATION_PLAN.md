# Reputation 페이지 최적화 계획서

## 현재 상태 분석

### 이미 적용된 최적화 (Good)
1. **API 분할 구현됨**: `getMyReputationSummary` (초기) + `getMyReputationDetails` (지연 로드)
2. **지연 로드 패턴**: Summary 로드 후 500ms 후 Details 자동 로드
3. **조건부 스켈레톤**: Details 로딩 중 `SectionSkeleton` 표시
4. **useCallback 사용**: `fetchDetails` 함수 메모이제이션

### 문제점 및 개선 기회

#### 1. Hero 섹션 블로킹 (Critical)
```tsx
// 현재: Line 98-107
if (isSummaryLoading) {
  return (
    <div className="reputation-loading">
      <div className="loading-spinner"></div>
      <p>{t('loading')}</p>
    </div>
  );
}
```
- **문제**: Summary API 완료까지 전체 페이지 블로킹
- **영향**: 사용자가 빈 화면에서 대기
- **해결**: user 데이터로 Hero 즉시 렌더링

#### 2. 캐싱 없음
```tsx
// 현재: 매 페이지 진입마다 API 재호출
useEffect(() => {
  const fetchSummary = async () => {
    // ...API 호출
  };
  fetchSummary();
}, [accessToken, i18n.language, t]);
```
- **문제**: profileStore 활용 안함
- **해결**: Profile에서 만든 `useProfileStore` 확장 또는 reputationStore 생성

#### 3. 메모이제이션 부족
```tsx
// 현재: 매 렌더마다 재생성
const categoryLabels: Record<string, string> = { ... };
const hexagonData: Record<string, number> = { ... };
const reputationStatCards: HeroStatCard[] = [ ... ];
```
- **문제**: 불필요한 객체/배열 재생성
- **해결**: useMemo 적용

#### 4. 중복 유틸리티 함수
```tsx
// Profile.tsx와 Reputation.tsx에 동일한 함수 존재
const getGradientStyle = (gradientColors: string) => { ... };
const formatDate = (dateString?: string) => { ... };
```
- **문제**: 코드 중복, 유지보수 어려움
- **해결**: 공통 유틸리티로 분리

#### 5. Lazy Loading 미흡
```tsx
// 현재: Summary 로드 후 500ms 후 무조건 Details 로드
useEffect(() => {
  if (summaryData && !detailsFetched) {
    const timer = setTimeout(fetchDetails, 500);
    return () => clearTimeout(timer);
  }
}, [summaryData, detailsFetched, fetchDetails]);
```
- **문제**: 화면에 안 보이는 섹션도 로드
- **해결**: Intersection Observer로 viewport 진입 시 로드

#### 6. 스켈레톤 UI 부족
- Hero 영역: 전체 로딩 스피너만
- Endorsement 섹션: 스켈레톤 없음
- Activity Timeline: 스켈레톤 없음

---

## 최적화 전략

### Phase 1: 즉각적인 개선 (Critical Path)

#### 1.1 Hero 섹션 즉시 렌더링
```tsx
// 변경 후: user 데이터로 Hero 먼저 표시
return (
  <div className="reputation-container">
    {/* Hero는 항상 표시 (user 데이터 사용) */}
    <HeroSection
      username={user.username}
      email={user.email}
      photoUrl={getDisplayPhotoUrl(user)}
      metaStats={/* user 기반 기본값 */}
      statCards={isSummaryLoading ? [] : reputationStatCards}
      isLoading={isSummaryLoading}
    />

    {/* 나머지 섹션은 로딩 상태별 처리 */}
    {isSummaryLoading ? (
      <EndorsementSkeleton />
    ) : (
      <EndorsementSection data={summaryData} />
    )}
  </div>
);
```

#### 1.2 스켈레톤 컴포넌트 확장
```tsx
// components/reputation/ReputationSkeletons.tsx
export const HeroSkeleton: React.FC = () => ( ... );
export const EndorsementSkeleton: React.FC = () => ( ... );
export const AttendanceSkeleton: React.FC = () => ( ... );
export const BadgesSkeleton: React.FC = () => ( ... );
export const ActivitySkeleton: React.FC = () => ( ... );
```

---

### Phase 2: 캐싱 및 Store 통합

#### 2.1 reputationStore 생성 (또는 profileStore 확장)
```tsx
// store/reputationStore.ts
interface ReputationState {
  // Summary data (빠른 로드)
  summaryData: ReputationSummaryResponse | null;
  isSummaryLoading: boolean;
  summaryCacheTime: number | null;

  // Details data (지연 로드)
  detailsData: ReputationDetailsResponse | null;
  isDetailsLoading: boolean;
  detailsCacheTime: number | null;

  // Cache control
  cacheLocale: string | null;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5분

export const useReputationStore = create<ReputationStore>((set, get) => ({
  fetchSummary: async (token, locale) => {
    // 캐시 유효하면 스킵
    if (isCacheValid(get().summaryCacheTime, get().cacheLocale, locale)) {
      return;
    }
    // ... API 호출
  },
  fetchDetails: async (token, locale) => {
    // ... 지연 로드
  },
}));
```

---

### Phase 3: 메모이제이션 강화

#### 3.1 정적 데이터 메모이제이션
```tsx
// 변경 후: useMemo 적용
const categoryLabels = useMemo(() => ({
  ENGAGEMENT: t('endorsement_engagement'),
  COMMUNICATION: t('endorsement_communication'),
  // ...
}), [t]);

const hexagonData = useMemo(() => {
  const data: Record<string, number> = {};
  endorsementCategories.forEach(cat => {
    data[cat] = cat === endorsement?.topCategory
      ? Math.round(topCategoryScore)
      : Math.round(endorsement?.averageScore || 0);
  });
  return data;
}, [endorsement?.topCategory, endorsement?.averageScore, topCategoryScore]);

const reputationStatCards = useMemo(() => [
  { iconClass: 'ri-calendar-check-fill', ... },
  // ...
], [stats, t]);
```

#### 3.2 콜백 메모이제이션
```tsx
const formatDate = useCallback((dateString?: string) => {
  // ...
}, [i18n.language]);

const getGradientStyle = useCallback((gradientColors?: string) => {
  // ...
}, []);
```

---

### Phase 4: 유틸리티 분리

#### 4.1 공통 유틸리티 생성
```tsx
// utils/gradientUtils.ts
export const getGradientStyle = (gradientColors?: string): string => {
  // ... 공통 로직
};

// utils/dateUtils.ts
export const formatDateLocalized = (
  dateString?: string,
  locale: string = 'en'
): string => {
  // ...
};
```

---

### Phase 5: Intersection Observer Lazy Loading

#### 5. Viewport 기반 지연 로드
```tsx
// hooks/useIntersectionLoader.ts
export const useIntersectionLoader = (
  callback: () => void,
  options?: IntersectionObserverInit
) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback();
        observer.disconnect();
      }
    }, options);

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [callback, options]);

  return ref;
};

// 사용
const badgesSectionRef = useIntersectionLoader(fetchDetails, {
  threshold: 0.1,
  rootMargin: '100px',
});

<section ref={badgesSectionRef} className="badges-section">
  {/* ... */}
</section>
```

---

## 구현 우선순위

| 순위 | 항목 | 난이도 | 영향도 | 설명 |
|------|------|--------|--------|------|
| 1 | Hero 즉시 렌더링 | 낮음 | 높음 | 가장 빠른 체감 개선 |
| 2 | 스켈레톤 컴포넌트 | 중간 | 높음 | CLS 제거, UX 향상 |
| 3 | reputationStore 생성 | 중간 | 높음 | 캐싱으로 재방문 최적화 |
| 4 | useMemo 적용 | 낮음 | 중간 | 렌더링 성능 개선 |
| 5 | 유틸리티 분리 | 낮음 | 낮음 | 코드 품질 개선 |
| 6 | Intersection Observer | 중간 | 중간 | 초기 로드 최적화 |

---

## 예상 개선 효과

| 지표 | 현재 예상 | 최적화 후 목표 |
|------|----------|---------------|
| FCP (First Contentful Paint) | ~1000ms | < 300ms |
| LCP (Largest Contentful Paint) | ~1800ms | < 800ms |
| TTI (Time to Interactive) | ~2200ms | < 1000ms |
| 재방문 시 로딩 | ~1500ms | < 100ms (캐시) |

---

## 파일 변경 목록

### 신규 파일
- `frontend/src/components/reputation/ReputationSkeletons.tsx`
- `frontend/src/components/reputation/ReputationSkeletons.css`
- `frontend/src/store/reputationStore.ts`
- `frontend/src/utils/gradientUtils.ts`
- `frontend/src/utils/dateUtils.ts`
- `frontend/src/hooks/useIntersectionLoader.ts`

### 수정 파일
- `frontend/src/screens/Reputation.tsx` (메인 리팩토링)
- `frontend/src/screens/Profile.tsx` (유틸리티 import 변경)
- `frontend/src/components/profile/ProfileSkeletons.tsx` (공통 스켈레톤 활용)

---

## Profile vs Reputation 최적화 비교

| 항목 | Profile | Reputation |
|------|---------|------------|
| API 분할 | 단일 API (getMyReputation) | 분할됨 (summary + details) |
| Hero 블로킹 | 해결됨 ✅ | 미해결 ❌ |
| 캐싱 | profileStore ✅ | 없음 ❌ |
| 스켈레톤 | 탭별 스켈레톤 ✅ | 부분적 |
| 메모이제이션 | 적용됨 ✅ | 미흡 ❌ |

---

## 결론

Reputation 페이지는 이미 API 분할이 잘 되어 있지만, **Hero 블로킹**과 **캐싱 부재**가 주요 병목입니다.

**핵심 개선 3가지:**
1. Hero 섹션 즉시 렌더링 (user 데이터 활용)
2. reputationStore 생성 (5분 캐싱)
3. 스켈레톤 UI 확장 (모든 섹션)

이 세 가지만 적용해도 체감 로딩 속도가 크게 개선됩니다.
