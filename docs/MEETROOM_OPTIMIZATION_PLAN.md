# MeetRoom 페이지 최적화 계획

## 현재 상태 분석

**파일 크기**: 1,519줄 (대규모 컴포넌트)

### 이미 최적화된 부분 (Good)

#### 1. useCallback 광범위 적용
```tsx
// 거의 모든 핸들러가 useCallback으로 래핑됨
const handleRaiseHand = useCallback(async () => { ... }, [sessionId, accessToken, user]);
const handleNextSpeaker = useCallback(async () => { ... }, [sessionId, accessToken, ...]);
const handleRemoveFromQueue = useCallback(async () => { ... }, [sessionId, accessToken]);
// ... 20+ 핸들러 모두 useCallback 적용
```

#### 2. useMemo 적용
```tsx
const userPhotoUrl = useMemo(() =>
  getDisplayPhotoUrl(user) || '',
  [user?.photo?.google, user?.photo?.custom]
);
```

#### 3. Ref 적절한 사용
```tsx
const notesRef = useRef<CollaborativeNotesRef>(null);
const recordingSpeakerRef = useRef<{...} | null>(null);
const hasReceivedWebSocketQueue = useRef(false);  // Race condition 방지
const prevSpeakerIdRef = useRef<string | null>(null);  // 이전 값 추적
```

#### 4. 컴포넌트 분리
- `ModeratorControls` - 좌측 패널
- `VoiceChat` - 음성 채팅
- `CollaborativeNotes` - 협업 노트
- `AISummaryPanel` - AI 요약
- `UtterancePanel` - 발언 전사
- `AttendanceProgress` - 출석 진행
- 각 컴포넌트가 별도 파일로 분리됨

#### 5. Custom Hooks 사용
```tsx
const { isConnected, subscribe, send } = useWebSocket(sessionId || '');
const { isJoined, isMuted, ... } = useWebRTC({ ... });
const { utterances, ... } = useUtterances({ ... });
const { isRecording, ... } = useUtteranceRecorder({ ... });
```

---

### 개선이 필요한 부분

#### 1. 파생 값 메모이제이션 없음
```tsx
// 현재: 매 렌더마다 재계산
const isHost = queue?.moderatorId
  ? user?.id === queue.moderatorId
  : user?.id === session?.post?.createrId;

const isCreator = user?.id === session?.post?.createrId;

const hasRaisedHand = queue?.participants?.find(p => p.userId === user?.id)?.hasRaisedHand || false;

// 개선: useMemo 적용
const isHost = useMemo(() =>
  queue?.moderatorId
    ? user?.id === queue.moderatorId
    : user?.id === session?.post?.createrId,
  [queue?.moderatorId, user?.id, session?.post?.createrId]
);
```

#### 2. 대규모 상태 관리 (25+ useState)
```tsx
// 현재: 25개 이상의 useState
const [session, setSession] = useState<GetSessionResponse | null>(null);
const [hostUsername, setHostUsername] = useState<string>('');
const [initialNoteContent, setInitialNoteContent] = useState<any>(null);
const [aiNoteContent, setAiNoteContent] = useState<any>(null);
const [queue, setQueue] = useState<SpeakingQueue | null>(null);
const [recording, setRecording] = useState<SessionRecording | null>(null);
const [isLoadingState, setIsLoadingState] = useState(true);
const [error, setError] = useState<string | null>(null);
// ... 17개 더
```
- 실시간 미팅 페이지 특성상 캐싱이 큰 의미 없음
- Store로 이동하는 것은 과도한 리팩토링
- **현상태 유지 권장**

#### 3. 긴 fetchData 함수 (160줄)
```tsx
useEffect(() => {
  const fetchData = async () => {
    // 160줄의 데이터 페칭 로직
  };
  fetchData();
}, [sessionId, accessToken, navigate, t, isLoading]);
```
- Custom hook으로 추출 가능 (`useMeetRoomData`)
- 하지만 실시간 미팅 특성상 복잡한 상호작용이 많아 분리 시 오히려 복잡해질 수 있음
- **우선순위 낮음**

#### 4. 공유 유틸리티 미사용
```tsx
// 현재: 자체 구현
const formatUtteranceTimestamp = useCallback((dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const langCode = t('code') || 'en';

  if (langCode === 'ko') {
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ... });
  } else {
    return date.toLocaleString('en-US', { timeZone: 'America/New_York', ... });
  }
}, [t]);
```
- timezone까지 처리하므로 기존 dateUtils와 다름
- 하지만 로직 정리 가능

#### 5. 인라인 스타일
```tsx
// 현재
<div className="meetroom-ended-overlay" style={{ position: 'relative', background: '#f8fafc' }}>

// 개선: CSS 클래스 사용
<div className="meetroom-ended-overlay meetroom-ended-overlay-static">
```

#### 6. Skeleton UI 없음
```tsx
// 현재: 단순 스피너
if (isLoading || isLoadingState) {
  return (
    <div className="meetroom-loading">
      <FiLoader className="meetroom-loading-spinner" size={48} />
      <p>{t('loading') || 'Loading...'}</p>
    </div>
  );
}
```
- 실시간 미팅 페이지에서는 스켈레톤보다 스피너가 더 적합할 수 있음
- **현상태 유지 권장**

---

## 최적화 전략

### 권장: 최소한의 개선만 진행

MeetRoom은 실시간 미팅 페이지로, 다음 특성이 있음:
- **일회성 사용**: 캐싱 효과 낮음
- **복잡한 실시간 상태**: WebSocket, WebRTC, 여러 참가자 상태
- **이미 상당히 최적화됨**: useCallback, useMemo, 컴포넌트 분리

### Phase 1: 파생 값 메모이제이션 (필수)

```tsx
// isHost 메모이제이션
const isHost = useMemo(() =>
  queue?.moderatorId
    ? user?.id === queue.moderatorId
    : user?.id === session?.post?.createrId,
  [queue?.moderatorId, user?.id, session?.post?.createrId]
);

// isCreator 메모이제이션
const isCreator = useMemo(() =>
  user?.id === session?.post?.createrId,
  [user?.id, session?.post?.createrId]
);

// hasRaisedHand 메모이제이션
const hasRaisedHand = useMemo(() =>
  queue?.participants?.find(p => p.userId === user?.id)?.hasRaisedHand || false,
  [queue?.participants, user?.id]
);
```

### Phase 2: 인라인 스타일 제거 (선택)

```css
/* CSS에 추가 */
.meetroom-ended-overlay-static {
  position: relative;
  background: #f8fafc;
}
```

### Phase 3: 미사용 변수 정리 (선택)

```tsx
// 현재: 사용되지 않는 변수
const [_presence, setPresence] = useState<PresenceMessage[]>([]);
const [_meetingEndedBy, setMeetingEndedBy] = useState<string | null>(null);

// _presence는 WebSocket에서 받지만 렌더링에 미사용
// _meetingEndedBy도 set만 하고 사용 안함
```

---

## 구현 체크리스트

### Task 1: 파생 값 메모이제이션
- [ ] `isHost` → useMemo
- [ ] `isCreator` → useMemo
- [ ] `hasRaisedHand` → useMemo

### Task 2: 인라인 스타일 CSS 이동 (선택)
- [ ] `.meetroom-ended-overlay-static` 클래스 추가
- [ ] 인라인 style 제거

### Task 3: TypeScript 검증
- [ ] `npx tsc --noEmit` 통과 확인

---

## 예상 결과

| 항목 | Before | After |
|------|--------|-------|
| `isHost` 계산 | 매 렌더 | 의존성 변경 시만 |
| `isCreator` 계산 | 매 렌더 | 의존성 변경 시만 |
| `hasRaisedHand` 계산 | 매 렌더 | 의존성 변경 시만 |
| 인라인 스타일 | 1개 | 0개 |

---

## 최적화 규모

**매우 작음** - 이미 잘 최적화되어 있음

| 카테고리 | 상태 |
|----------|------|
| useCallback | ✅ 완료 (20+ 핸들러) |
| useMemo | ⚠️ 일부 추가 필요 (3개) |
| 컴포넌트 분리 | ✅ 완료 |
| Custom Hooks | ✅ 완료 |
| Skeleton UI | ➖ 불필요 (실시간 특성) |
| Store 캐싱 | ➖ 불필요 (일회성) |

---

## 미최적화 권장 사항

다음은 의도적으로 최적화하지 않는 것이 좋음:

1. **State를 Store로 이동**: 실시간 미팅 특성상 캐싱 효과 없음
2. **fetchData 분리**: 상호작용이 많아 분리 시 오히려 복잡
3. **Skeleton UI**: 실시간 페이지에서는 스피너가 더 적합
4. **WebSocket 구독 분리**: 의존성이 서로 연결되어 있어 분리 어려움

---

## 파일 변경 요약

### 수정 파일
1. `frontend/src/screens/MeetRoom.tsx` - 파생 값 메모이제이션
2. `frontend/src/screens/styles/MeetRoom.css` - 인라인 스타일 이동 (선택)
