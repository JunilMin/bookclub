# Profile 페이지 최적화 계획서

## 현재 상태 분석

### 문제점

1. **전체 페이지 블로킹 로딩**
   - Line 289: `(isLoading || isBoardLoading)` 조건으로 모든 콘텐츠가 블로킹됨
   - `getMyReputation()` API가 완료될 때까지 아무것도 표시 안됨
   - Hero 섹션, 탭 등 즉시 표시 가능한 UI도 대기

2. **무거운 단일 API 호출**
   - `getMyReputation()` 하나의 API에서 모든 데이터 반환:
     - participationStats
     - endorsementStats
     - recentActivities
     - badgeInfo
   - 모든 탭에 필요한 데이터를 한 번에 로드

3. **비활성 탭 콘텐츠도 렌더링**
   - 4개 탭(overview, activity, badges, interests) 모두 렌더링 후 조건부 표시
   - 불필요한 DOM 노드 생성

4. **스켈레톤 UI 부재**
   - 단순 "loading" 텍스트만 표시
   - 사용자 경험(UX) 저하

5. **이미지 최적화 미흡**
   - 프로필 이미지 lazy loading 없음
   - 에러 핸들링은 있으나 429 에러 시 재시도 로직 없음

---

## 최적화 전략

### Phase 1: 즉각적인 개선 (Critical Path 최적화)

#### 1.1 Hero 섹션 우선 렌더링
**목표**: 페이지 진입 시 즉시 Hero 섹션 표시

```tsx
// 변경 전
{(isLoading || isBoardLoading) ? (
  <div className="profile-loading">{t('loading')}</div>
) : (
  <>
    {/* 모든 콘텐츠 */}
  </>
)}

// 변경 후
{/* Hero 섹션은 항상 표시 (user 데이터만 필요) */}
<div className="profile-hero-section">
  {/* ... user 기반 정보 표시 */}
</div>

{/* 탭 콘텐츠만 로딩 조건 적용 */}
<div className="profile-content">
  {activeSection === 'overview' && (
    isLoading ? <OverviewSkeleton /> : <OverviewContent />
  )}
</div>
```

**예상 효과**: 페이지 진입 즉시 프로필 정보 표시 (0ms → 즉시)

#### 1.2 스켈레톤 UI 추가
**목표**: 로딩 중에도 레이아웃 유지

```tsx
// 새 컴포넌트 생성: ProfileSkeleton.tsx
const OverviewSkeleton = () => (
  <div className="profile-overview-section">
    <div className="profile-card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-progress" />
      <div className="skeleton skeleton-progress" />
    </div>
  </div>
);
```

**예상 효과**: CLS(Cumulative Layout Shift) 제거, 체감 로딩 속도 향상

---

### Phase 2: API 분할 및 Lazy Loading

#### 2.1 Reputation API 분할
**목표**: 필요한 데이터만 요청

**백엔드 변경**:
```java
// 기존: /api/users/me/reputation (전체 반환)

// 신규 엔드포인트:
GET /api/users/me/reputation/summary     // Hero용 요약 (participationStats, endorsementStats.categoryScores)
GET /api/users/me/reputation/activities  // Activity 탭용
GET /api/users/me/reputation/badges      // Badges 탭용
```

**프론트엔드 변경**:
```tsx
// Phase 1: 페이지 로드 시 summary만 요청
useEffect(() => {
  getReputationSummary(accessToken).then(setReputationSummary);
}, [accessToken]);

// Phase 2: 탭 전환 시 필요한 데이터 lazy load
useEffect(() => {
  if (activeSection === 'activity' && !activitiesLoaded) {
    getReputationActivities(accessToken).then(setActivities);
  }
  if (activeSection === 'badges' && !badgesLoaded) {
    getReputationBadges(accessToken).then(setBadges);
  }
}, [activeSection]);
```

**예상 효과**: 초기 로딩 데이터 ~60% 감소

#### 2.2 탭 콘텐츠 Lazy Rendering
**목표**: 활성 탭만 렌더링

```tsx
// React.lazy + Suspense 활용
const ActivityTab = React.lazy(() => import('./ProfileActivityTab'));
const BadgesTab = React.lazy(() => import('./ProfileBadgesTab'));
const InterestsTab = React.lazy(() => import('./ProfileInterestsTab'));

// 탭 렌더링
{activeSection === 'activity' && (
  <Suspense fallback={<ActivitySkeleton />}>
    <ActivityTab data={activities} />
  </Suspense>
)}
```

**예상 효과**: 초기 번들 크기 감소, 불필요한 렌더링 제거

---

### Phase 3: 캐싱 및 최적화

#### 3.1 Zustand Store 도입 (Reputation 데이터)
**목표**: 페이지 재방문 시 캐시 활용

```tsx
// store/reputationStore.ts
interface ReputationStore {
  summary: ReputationSummary | null;
  activities: Activity[] | null;
  badges: BadgeInfo | null;
  lastFetched: number;

  fetchSummary: (token: string) => Promise<void>;
  fetchActivities: (token: string) => Promise<void>;
  fetchBadges: (token: string) => Promise<void>;
}

export const useReputationStore = create<ReputationStore>((set, get) => ({
  // 5분 캐시
  fetchSummary: async (token) => {
    const { summary, lastFetched } = get();
    if (summary && Date.now() - lastFetched < 5 * 60 * 1000) return;

    const data = await getReputationSummary(token);
    set({ summary: data, lastFetched: Date.now() });
  },
  // ...
}));
```

**예상 효과**: 재방문 시 즉시 렌더링 (API 호출 생략)

#### 3.2 이미지 최적화
**목표**: 프로필 이미지 빠른 로딩

```tsx
// 1. Progressive loading with blur placeholder
const [imageLoaded, setImageLoaded] = useState(false);

<div className="profile-hero-avatar-wrapper">
  {!imageLoaded && <div className="avatar-placeholder blur" />}
  <img
    src={avatarUrl}
    alt={user.username}
    loading="lazy"
    onLoad={() => setImageLoaded(true)}
    style={{ opacity: imageLoaded ? 1 : 0 }}
  />
</div>

// 2. 429 에러 시 재시도 로직 (3회, 지수 백오프)
const loadImageWithRetry = async (url: string, retries = 3) => {
  // ...
};
```

**예상 효과**: 이미지 로딩 실패 감소, 체감 속도 향상

---

### Phase 4: 고급 최적화

#### 4.1 Prefetching
**목표**: 사용자 행동 예측 기반 미리 로드

```tsx
// 탭 hover 시 prefetch
const handleTabHover = (section: string) => {
  if (section === 'activity' && !activitiesLoaded) {
    prefetchActivities(accessToken);
  }
};

<button
  onMouseEnter={() => handleTabHover('activity')}
  onClick={() => setActiveSection('activity')}
>
  {t('profile_tab_recent_activity')}
</button>
```

#### 4.2 Virtual Scrolling (대량 데이터 대비)
**목표**: 많은 activities/badges 효율적 렌더링

```tsx
// react-window 또는 @tanstack/react-virtual 활용
import { useVirtualizer } from '@tanstack/react-virtual';

// activities가 50개 이상일 경우만 적용
{activities.length > 50 ? (
  <VirtualActivityList activities={activities} />
) : (
  <ActivityList activities={activities} />
)}
```

---

## 구현 우선순위

| 순위 | 항목 | 난이도 | 영향도 | 예상 시간 |
|------|------|--------|--------|-----------|
| 1 | Hero 섹션 우선 렌더링 | 낮음 | 높음 | 30분 |
| 2 | 스켈레톤 UI 추가 | 중간 | 높음 | 1시간 |
| 3 | API 분할 (백엔드) | 중간 | 높음 | 2시간 |
| 4 | 탭별 Lazy Loading | 낮음 | 중간 | 1시간 |
| 5 | Reputation Store | 중간 | 중간 | 1시간 |
| 6 | 이미지 최적화 | 낮음 | 낮음 | 30분 |
| 7 | Prefetching | 낮음 | 낮음 | 30분 |
| 8 | Virtual Scrolling | 높음 | 낮음 | 2시간 |

---

## 측정 지표

### Before/After 비교 기준

| 지표 | 현재 예상 | 최적화 후 목표 |
|------|----------|---------------|
| FCP (First Contentful Paint) | ~800ms | < 200ms |
| LCP (Largest Contentful Paint) | ~1500ms | < 500ms |
| TTI (Time to Interactive) | ~2000ms | < 800ms |
| CLS (Cumulative Layout Shift) | 0.15 | < 0.05 |
| API 요청 크기 (초기) | ~15KB | < 5KB |

### 측정 방법
```bash
# Lighthouse CI
npx lighthouse http://localhost:5173/profile --view

# React DevTools Profiler
# Chrome DevTools > Performance 탭
```

---

## 파일 변경 목록

### 신규 파일
- `frontend/src/components/profile/ProfileSkeleton.tsx`
- `frontend/src/components/profile/ProfileActivityTab.tsx`
- `frontend/src/components/profile/ProfileBadgesTab.tsx`
- `frontend/src/components/profile/ProfileInterestsTab.tsx`
- `frontend/src/store/reputationStore.ts`
- `backend/.../user/controller/ReputationController.java` (기존 분할)

### 수정 파일
- `frontend/src/screens/Profile.tsx` (메인 리팩토링)
- `frontend/src/screens/styles/Profile.css` (스켈레톤 스타일 추가)
- `frontend/src/api/user.tsx` (신규 API 함수 추가)
- `backend/.../user/UserService.java` (API 분할 로직)

---

## 결론

**핵심 원칙**: "사용자가 보는 것을 먼저 보여주고, 나머지는 백그라운드에서 로드"

가장 중요한 개선 사항:
1. **Hero 섹션 즉시 렌더링** - 사용자가 "로딩 중"이라는 느낌을 받지 않음
2. **스켈레톤 UI** - 레이아웃 안정성 확보
3. **API 분할** - 필요한 데이터만 요청

이 세 가지만 구현해도 체감 로딩 속도가 크게 개선됩니다.
