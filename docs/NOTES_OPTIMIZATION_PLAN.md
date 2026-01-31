# Notes 페이지 최적화 계획

## 현재 상태 분석

### 이미 최적화된 부분 (Good)

#### 1. Zustand Store 존재 (`notesStore.ts`)
```tsx
// 정규화된 상태 구조
byId: Record<string, UserNoteResponse>;
order: string[];

// 초기/새로고침 분리
initNotes()     // 최초 로딩 (스피너 표시)
refreshNotes()  // 백그라운드 갱신 (조용히)

// 중복 요청 방지
inFlight: boolean;

// 낙관적 업데이트
toggleFavorite(noteId)
```

#### 2. useMemo 활용
```tsx
// 정규화 → 배열 변환
const notes = useMemo(() =>
  order.map((id) => byId[id]).filter(Boolean),
  [byId, order]
);

// 필터링 + 정렬
const filteredNotes = useMemo(() => { ... }, [notes, activeTab, searchQuery, sortBy]);

// 통계
const stats = useMemo(() => { ... }, [notes, user]);
```

#### 3. 기본 Skeleton UI 존재
```tsx
<div className="notes-card skeleton">
  <div className="skeleton-cover" />
  <div className="skeleton-title" />
  <div className="skeleton-text" />
</div>
```

#### 4. Lazy Loading
```tsx
<img loading="lazy" ... />
```

---

### 개선이 필요한 부분

#### 1. 캐시 기간 체크 없음
```tsx
// 현재: 데이터 존재 여부만 체크
if (Object.keys(state.byId).length > 0) {
  get().refreshNotes(accessToken);  // 항상 새로고침
  return;
}

// 개선: 5분 캐시 추가
const CACHE_DURATION_MS = 5 * 60 * 1000;
if (state.lastFetchTime && Date.now() - state.lastFetchTime < CACHE_DURATION_MS) {
  return;  // 캐시 유효하면 스킵
}
```

#### 2. 헬퍼 함수 메모이제이션 없음
```tsx
// 현재: 컴포넌트 외부에 정의되어 있지만, locale 지원 없음
function formatDate(isoString: string): string {
  return date.toLocaleDateString('ko-KR', { ... });  // 하드코딩
}

// 개선: 공유 유틸리티 사용
import { formatDateFull } from '../utils/dateUtils';
const formatDate = useCallback(
  (dateString: string) => formatDateFull(dateString, locale),
  [locale]
);
```

#### 3. useCallback 없음
```tsx
// 현재: 인라인 핸들러
onChange={(e) => setSearchQuery(e.target.value)}
onClick={() => setActiveTab('all')}

// 개선: useCallback으로 메모이제이션
const handleSearchChange = useCallback((e) => {
  setSearchQuery(e.target.value);
}, []);
```

#### 4. Hero 통계 로딩 처리 없음
```tsx
// 현재: 로딩 중 0 표시
<span className="notes-stat-value">{stats.total}</span>

// 개선: 스켈레톤 표시
{isLoading ? <StatsSkeleton /> : <StatsDisplay stats={stats} />}
```

#### 5. 카드 컴포넌트 미분리
```tsx
// 현재: 130줄 인라인 렌더링
{filteredNotes.map((note) => (
  <div className="notes-card">
    {/* 130줄의 JSX */}
  </div>
))}

// 개선: React.memo로 분리
const NoteCard = React.memo(({ note, viewMode, ... }) => ( ... ));
```

#### 6. 미사용 Selector
```tsx
// Store에 정의됨
export const selectAllNotes = (state) => state.order.map(...);

// 컴포넌트에서 미사용 (직접 계산)
const notes = useMemo(() => order.map((id) => byId[id]), [byId, order]);
```

---

## 최적화 전략

### Phase 1: notesStore 캐싱 개선

**파일**: `frontend/src/store/notesStore.ts`

```tsx
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5분

const isCacheValid = (lastFetchTime: number | null): boolean => {
  if (!lastFetchTime) return false;
  return Date.now() - lastFetchTime < CACHE_DURATION_MS;
};

initNotes: async (accessToken: string) => {
  const state = get();

  // 캐시 유효하면 스킵
  if (isCacheValid(state.lastFetchTime)) {
    return;
  }

  // 데이터 있으면 백그라운드 갱신
  if (Object.keys(state.byId).length > 0) {
    get().refreshNotes(accessToken);
    return;
  }

  // 최초 로딩
  set({ isInitialLoading: true, ... });
  // ...
}
```

---

### Phase 2: Notes.tsx 최적화

#### 2.1 공유 유틸리티 사용

```tsx
import { formatDateFull } from '../utils/dateUtils';

const locale = useMemo(() =>
  (i18n.language === 'ko' ? 'ko' : 'en') as 'ko' | 'en',
  [i18n.language]
);

const formatDate = useCallback(
  (dateString: string) => formatDateFull(dateString, locale),
  [locale]
);
```

#### 2.2 useCallback 적용

```tsx
const handleSearchChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
  []
);

const handleSearchClear = useCallback(() => setSearchQuery(''), []);

const handleSortChange = useCallback(
  (e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortBy),
  []
);

const handleViewModeChange = useCallback(
  (mode: ViewMode) => setViewMode(mode),
  []
);

const handleTabChange = useCallback(
  (tab: FilterTab) => setActiveTab(tab),
  []
);

const handleNoteClick = useCallback(
  (noteId: string) => navigate(`/notes/${noteId}`),
  [navigate]
);

const handleToggleFavorite = useCallback(
  (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    toggleFavorite(noteId);
  },
  [toggleFavorite]
);
```

#### 2.3 Hero Stats 스켈레톤

```tsx
{isLoading ? (
  <HeroStatsSkeleton />
) : (
  <div className="notes-stats">
    <StatCard icon={<FiFileText />} value={stats.total} label={t('notes_stat_summaries')} />
    ...
  </div>
)}
```

#### 2.4 NoteCard 컴포넌트 분리

```tsx
interface NoteCardProps {
  note: UserNoteResponse;
  viewMode: ViewMode;
  onNoteClick: (noteId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, noteId: string) => void;
  formatDate: (dateString: string) => string;
  t: (key: string) => string;
}

const NoteCard = React.memo<NoteCardProps>(({
  note, viewMode, onNoteClick, onToggleFavorite, formatDate, t
}) => (
  <div className={`notes-card ${viewMode}`} onClick={() => onNoteClick(note.noteId)}>
    {/* Card content */}
  </div>
));

NoteCard.displayName = 'NoteCard';
```

---

### Phase 3: Skeleton 컴포넌트 분리 (선택)

현재 인라인 스켈레톤이 있으므로, 별도 파일로 분리는 선택사항입니다.

```tsx
// 현재 (유지 가능)
{Array.from({ length: 6 }).map((_, i) => (
  <div key={i} className="notes-card skeleton">...</div>
))}

// 또는 분리
import { NoteCardSkeleton, HeroStatsSkeleton } from '../components/notes/NotesSkeletons';
```

---

## 구현 체크리스트

### Task 1: notesStore 캐싱 개선
- [ ] `CACHE_DURATION_MS` 상수 추가
- [ ] `isCacheValid` 헬퍼 함수 추가
- [ ] `initNotes`에 캐시 체크 로직 추가

### Task 2: Notes.tsx 최적화
- [ ] 공유 유틸리티 import (`formatDateFull`)
- [ ] `locale` useMemo 추가
- [ ] `formatDate` useCallback으로 변경
- [ ] 이벤트 핸들러 useCallback 적용
- [ ] NoteCard 컴포넌트 분리 + React.memo
- [ ] Hero Stats 스켈레톤 조건부 렌더링

### Task 3: TypeScript 검증
- [ ] `npx tsc --noEmit` 통과 확인

---

## 예상 결과

| 항목 | Before | After |
|------|--------|-------|
| 캐시 | 데이터 존재 시 항상 refresh | 5분 캐시 |
| 날짜 포맷 | ko-KR 하드코딩 | locale 기반 |
| 이벤트 핸들러 | 매 렌더 재생성 | useCallback |
| 카드 렌더링 | 인라인 130줄 | 분리 + memo |
| Hero 로딩 | 0 표시 | 스켈레톤 |

---

## 최적화 규모

**작은 규모** - 이미 상당 부분 최적화되어 있음
- Store 구조 양호
- useMemo 적용됨
- 기본 스켈레톤 존재

**주요 개선점**:
1. 캐시 기간 추가 (5분)
2. locale 기반 날짜 포맷
3. useCallback 일괄 적용
4. NoteCard 분리

---

## 파일 변경 요약

### 수정 파일
1. `frontend/src/store/notesStore.ts` - 캐시 기간 체크 추가
2. `frontend/src/screens/Notes.tsx` - useCallback, NoteCard 분리, 공유 유틸리티
