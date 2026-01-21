# HANDOFF - BookClub 프로젝트 인수인계

## 프로젝트 전체 작업 히스토리

### Phase 1: 기본 인프라 구축
- Firebase Authentication 구현 (Google OAuth 포함)
- MongoDB 연동
- Spring Boot 백엔드 설정
- React + TypeScript 프론트엔드 설정

### Phase 2: 핵심 기능 구현
- **Google Meet 연동**: 모임 생성 시 자동으로 Meet 링크 생성
- **도서 검색 API**: Google Books API / Naver Books API 연동
- **메시징 시스템**: 1:1 메시지 기능
- **다국어 지원**: i18next를 통한 한국어/영어 지원

### Phase 3: 실시간 미팅룸 시스템
- **WebSocket (STOMP)** 기반 실시간 통신
- **발언 대기열**: 손 들기, 다음 발언자, 사회자 위임
- **협업 노트**: TipTap + Op-based CRDT 실시간 동시 편집
- **AI 요약**: OpenAI GPT-4o-mini로 토론 노트 요약

### Phase 4: 미팅룸 고도화
- **발언 대기열 Drag & Drop**: 사회자가 순서 변경 가능
- **참가자 → 발언대기열 추가**: 사회자가 직접 추가 가능
- **강퇴 기능**: 문제 참가자 강퇴
- **신고 기능**: 부적절한 행동 신고
- **평가 시스템**: 토론 후 상호 평가

### Phase 5: 세션 및 포스트 관리
- **종료하기 버튼**: 미팅 명시적 종료
- **상태 표시 개선**: 시작시간 + duration 기반 대기중/진행중/종료 표시
- **Google Calendar 동기화**: 포스트 수정/삭제 시 캘린더 이벤트도 동기화
- **Zustand 상태관리**: 전역 상태 관리 재구현
- **bookData 필드 생성**: Post에 책 정보 통합 저장

### Phase 6: 토론 노트 시스템
- **Notes 페이지**: 사용자별 토론 노트 목록
- **NoteDetail 페이지**: 개별 노트 상세 보기/편집
- **세션 종료 시 Fork**: 공유 노트를 각 멤버에게 개인 복사본으로 분배
- **포스트 애니메이션**: 카드 hover 효과

---

## 최근 세션 완료 작업 (현재)

### 1. Room Card 배경 이미지 시스템
- 5개의 랜덤 배경 이미지 사용
- **인접 카드 중복 방지**: 3x3 그리드에서 좌우상하 같은 배경 안 되도록 인덱스 기반 선택
- 배경 어둡게 처리 (`rgba(0, 0, 0, 0.15)` 오버레이)

### 2. BookData Cover 구조 변경
- **이전**: `cover: string` (단일 URL)
- **이후**: `cover: { small?: string, medium?: string }` (객체)

#### 변경된 파일
**Backend:**
- `backend/src/main/java/com/bookclub/backend/post/Post.java`
  - `BookCover` 내부 클래스 추가 (`small`, `medium` 필드)
  - `BookData.cover`를 `Object` 타입으로 변경 (하위 호환성)
  - `getCover()` getter에서 String/Map/BookCover 모두 처리

- `backend/src/main/java/com/bookclub/backend/session/dto/UserNoteResponse.java`
  - `bookCover` 타입을 `Post.BookCover`로 변경

- `backend/src/main/java/com/bookclub/backend/session/dto/NoteSummaryResponse.java`
  - `bookCover` 타입을 `Post.BookCover`로 변경

**Frontend:**
- `frontend/src/api/bookSearch.tsx`
  - Google Books API에서 `small` (zoom=1), `medium` (zoom=3) 가져오기
  - `BookThumbnail` 인터페이스 추가

- `frontend/src/api/posts.tsx`
  - `BookCover` 인터페이스 추가
  - `BookData.cover` 타입 변경

- `frontend/src/api/notes.ts`
  - `bookCover` 타입을 `{ small?: string; medium?: string }`로 변경

- `frontend/src/components/RoomModal.tsx`
  - `Room.book.cover` 타입을 `BookCover`로 변경

- `frontend/src/screens/Board.tsx`
  - `postToRoom` 함수에서 cover 객체 처리 (레거시 string 지원)

---

### 3. 3D Book UI 구현
Board 페이지와 Notes 페이지에 3D 책 효과 구현

#### 특징
- 정적 상태: 선명한 이미지 (3D transform 없음)
- Hover 시: 책이 25도 회전 + 앞으로 튀어나오는 효과
- 이미지 원본 비율 유지 (`object-fit: contain` 대신 `width/height: auto`)
- 책 크기가 썸네일 원본 크기에 맞춰 자동 조절

#### 변경된 파일
**Board 페이지:**
- `frontend/src/screens/Board.tsx` - 3D book 구조 사용
- `frontend/src/screens/styles/Board.css` - 3D book 스타일

**Notes 페이지:**
- `frontend/src/screens/Notes.tsx` - 3D book 구조 추가
- `frontend/src/screens/styles/Notes.css` - 3D book 스타일 추가

#### 3D Book HTML 구조
```html
<div class="book-container">      <!-- perspective: 1500px -->
  <div class="book">              <!-- transform-style: preserve-3d -->
    <div class="book-front">      <!-- hover 시 translateZ(9px) -->
      <div class="book-cover">    <!-- 이미지 컨테이너 -->
        <img />
        <p class="book-author">저자</p>
      </div>
    </div>
    <div class="book-left-side">  <!-- 책 옆면 (spine) -->
      <h2>제목</h2>
    </div>
  </div>
</div>
```

#### 이미지 깨짐 해결 과정
1. **문제 발견**: 정면에서 이미지가 픽셀화됨, hover 시에는 정상
2. **원인 분석**: `.book-front`의 `translate3d(0, 0, 9px)`가 브라우저 렌더링에 영향
3. **해결**: 정적 상태에서는 transform 없음, hover 시에만 `translate3d` 적용

---

### 4. 썸네일 사용 규칙
- 데이터: `small`, `medium` 둘 다 저장
- 썸네일 표시: 항상 `small` 우선 사용 (`small || medium || placeholder`)
- 적용 파일: `Board.tsx`, `Notes.tsx`, `Meeting.tsx`

---

### 5. 종료된 미팅 로직 구현
종료된 북미팅의 표시 및 접근 제어 구현

#### RoomModal.tsx 변경
- **종료된 미팅**: "Enter Meeting", "Open Meet" 버튼 숨김
- **대신 표시**: "View Notes" 버튼 (참가자/주최자만)
  - 아이콘: `FiEdit3`, `FiArrowRight`
  - 클릭 시 `/notes` 페이지로 이동
  - 스타일: `room-modal-btn-notes` (어두운 배경)

#### Board.tsx 필터링 로직
- **'all' 탭**: 종료된 미팅(`status === 'past'`)은 참가자/주최자가 아니면 숨김
  ```tsx
  result = result.filter(room =>
    room.status !== 'past' || room.isJoined || room.isMyRoom
  );
  ```
- **'my' 탭**: 내가 만든 모임만 표시 (종료된 미팅 포함)
- **'joined' 탭**: 참여 중인 모임만 표시 (종료된 미팅 포함)

#### 변경된 파일
- `frontend/src/components/RoomModal.tsx` - View Notes 버튼 추가
- `frontend/src/components/styles/RoomModal.css` - 버튼 스타일
- `frontend/src/screens/Board.tsx` - 필터링 로직 추가

---

### 6. User 모델 posts 리팩토링
User 모델의 `createdBookMeetings`와 `participatedBookMeetings` 필드를 `posts` 객체로 통합

#### 이전 구조
```java
private List<String> createdBookMeetings;
private List<String> participatedBookMeetings;
```

#### 새로운 구조
```java
private UserPosts posts;

public static class UserPosts {
    private List<String> created;      // 내가 생성한 북미팅 ID 리스트
    private List<String> participated; // 참여한 북미팅 ID 리스트
}
```

#### 변경된 파일
**Backend:**
- `backend/src/main/java/com/bookclub/backend/user/User.java` - UserPosts 내부 클래스 추가
- `backend/src/main/java/com/bookclub/backend/user/UserService.java` - ensurePostsInitialized() 헬퍼 추가, 모든 메서드 수정
- `backend/src/main/java/com/bookclub/backend/session/SessionService.java` - posts 접근 방식 변경

**Frontend:**
- `frontend/src/api/user.tsx` - UserPosts 인터페이스 추가, User 인터페이스 수정

**Documentation:**
- `CLAUDE.md` - User 모델 문서 업데이트

#### 하위 호환성
- `ensurePostsInitialized()` 헬퍼로 기존 데이터(null인 경우) 자동 초기화
- 기존 MongoDB 데이터는 마이그레이션 필요

---

## 다음에 해야 할 작업

### 1. NoteDetail 페이지 3D Book UI
- `/notes/:noteId` 페이지에도 동일한 3D 북 UI 적용 필요

### 2. Medium 이미지 활용
- 현재 `medium` (zoom=3)은 저장만 하고 사용하지 않음
- 모달이나 상세 페이지에서 고해상도 이미지가 필요할 때 `medium` 사용 고려

### 3. Google Books API 이미지 가용성
- `zoom=3`이 모든 책에서 제공되지 않을 수 있음
- 이미지 로드 실패 시 `small`로 폴백하는 로직 필요 (현재 placeholder로만 폴백)

### 4. 기존 데이터 마이그레이션
**BookData.cover:**
- MongoDB에 기존 `cover: string` 형식 데이터가 있음
- Backend에서 하위 호환성 처리 중 (`getCover()` getter)
- 필요 시 데이터 마이그레이션 스크립트 작성

**User.posts:**
- 기존 `createdBookMeetings`, `participatedBookMeetings` 필드 → `posts.created`, `posts.participated`로 변경
- Backend에서 `ensurePostsInitialized()` 헬퍼로 자동 초기화 처리
- 마이그레이션 스크립트 (MongoDB):
```javascript
db.user.updateMany(
  { createdBookMeetings: { $exists: true } },
  [{
    $set: {
      posts: {
        created: "$createdBookMeetings",
        participated: "$participatedBookMeetings"
      }
    },
    $unset: ["createdBookMeetings", "participatedBookMeetings"]
  }]
)
```

### 5. TypeScript 에러 수정
빌드 시 발생하는 기존 에러들:
- `creater` → `createrId` 이름 변경 관련
- `member` → `memberIds` 이름 변경 관련
- `book` → `bookData` 이름 변경 관련
- 일부 타입 불일치 문제

---

## 주의사항

### 1. 3D Transform과 이미지 품질
```css
/* 이렇게 하면 이미지가 깨짐 */
.book-front {
  transform: translate3d(0, 0, 9px);  /* 정적 상태에서 사용 금지 */
}

/* 이렇게 해야 함 */
.book-front {
  /* 정적: transform 없음 */
}
.card:hover .book-front {
  transform: translate3d(0, 0, 9px);  /* hover 시에만 */
}
```

### 2. Backend Cover 필드 타입
```java
// Post.BookData.cover는 Object 타입
// getCover()가 자동으로 변환 처리:
// - String → BookCover(url, url)
// - Map (MongoDB) → BookCover(small, medium)
// - BookCover → 그대로 반환
```

### 3. 이미지 크기 CSS
```css
.book-cover img {
  width: auto;
  height: auto;
  max-width: 150px;   /* 최대 크기 제한 */
  max-height: 220px;
}
```
- `object-fit: cover/contain` 사용 안 함
- 이미지 원본 비율 그대로 유지

### 4. CSS 클래스 네이밍
- Board: `.book-container`, `.book`, `.book-front`, `.book-cover`, `.book-left-side`
- Notes: `.notes-book-container`, `.notes-book`, `.notes-book-front`, `.notes-book-cover`, `.notes-book-left-side`

### 5. Google Books API 썸네일
```javascript
// zoom 레벨
// zoom=1: thumbnail (기본)
// zoom=2: small
// zoom=3: medium
// zoom=4: large
// zoom=5: smallThumbnail
// zoom=6: extraLarge

// 현재 사용
small: zoom=1 (thumbnail)
medium: zoom=3 (medium) - URL 파라미터 치환으로 생성
```

### 6. User.posts 구조
```java
// User.java 내부 클래스
// ArrayList import 필수: import java.util.ArrayList;
public static class UserPosts {
    private List<String> created;      // 생성한 북미팅 ID
    private List<String> participated; // 참여한 북미팅 ID

    public UserPosts(List<String> created, List<String> participated) {
        this.created = created != null ? created : new ArrayList<>();
        this.participated = participated != null ? participated : new ArrayList<>();
    }
}

// 접근 방법
user.getPosts().getCreated()      // 이전: user.getCreatedBookMeetings()
user.getPosts().getParticipated() // 이전: user.getParticipatedBookMeetings()

// null 체크 필요
if (user.getPosts() != null) {
    List<String> created = user.getPosts().getCreated();
}
```

---

## 기술 스택 요약

| 구분 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Spring Boot 3.3 + MongoDB |
| **상태관리** | Zustand |
| **인증** | Firebase Authentication |
| **도서 데이터** | Google Books API, Naver Books API |
| **다국어** | i18next |
| **화상회의** | Google Meet (via Google Calendar API) |
| **실시간 통신** | WebSocket (STOMP) |
| **협업 에디터** | TipTap + Op-based CRDT |
| **AI 요약** | OpenAI GPT-4o-mini |

---

## 테스트 체크리스트

### 3D Book UI
- [ ] Board 페이지 3D 북 hover 효과
- [ ] Board 페이지 이미지 선명도 (정적 상태)
- [ ] Notes 페이지 3D 북 hover 효과
- [ ] Notes 페이지 이미지 선명도 (정적 상태)
- [ ] 모바일 반응형 레이아웃

### Cover 데이터 호환성
- [ ] 기존 데이터 (cover가 string인 경우) 정상 표시
- [ ] 새로운 데이터 (cover가 객체인 경우) 정상 표시
- [ ] 새 포스트 생성 시 small/medium 모두 저장됨

### 배경 이미지
- [ ] 인접 카드 배경 중복 없음
- [ ] 배경 어둡게 처리됨
- [ ] 책 이미지가 배경 위에 잘 보임

### 종료된 미팅 로직
- [ ] RoomModal: 종료된 미팅에서 "View Notes" 버튼 표시
- [ ] RoomModal: 종료된 미팅에서 "Enter Meeting" 버튼 숨김
- [ ] RoomModal: 종료된 미팅에서 "Open Meet" 버튼 숨김
- [ ] Board 'all' 탭: 종료된 미팅 중 비참가자/비주최자 미팅 숨김
- [ ] Board 'my' 탭: 내가 만든 종료된 미팅 표시
- [ ] Board 'joined' 탭: 참여한 종료된 미팅 표시

### User.posts 리팩토링
- [ ] 새 사용자 가입 시 posts.created, posts.participated 빈 배열로 초기화
- [ ] 북미팅 생성 시 posts.created에 추가
- [ ] 북미팅 참여 시 posts.participated에 추가
- [ ] 북미팅 탈퇴 시 posts.participated에서 제거
- [ ] 북미팅 삭제 시 posts.created에서 제거
- [ ] Notes 페이지에서 사용자의 모든 노트 정상 조회
