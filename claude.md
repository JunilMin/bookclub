# BookClub - 기술 문서

## 프로젝트 개요

**BookClub**은 일회성 온라인 독서 토론 플랫폼입니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Spring Boot 3.3 + MongoDB |
| **인증** | Firebase Authentication (Google OAuth 포함) |
| **도서 데이터** | Google Books API (EN) / Naver Books API (KR) |
| **다국어** | i18next, react-i18next |
| **화상회의** | Google Meet (via Google Calendar API) |
| **실시간 통신** | WebSocket (STOMP) |
| **협업 에디터** | TipTap + Op-based CRDT |
| **AI 요약** | OpenAI GPT-4o-mini |

---

## 프로젝트 구조

```
bookclub/
├── frontend/                     # React + TypeScript
│   ├── src/
│   │   ├── api/                 # API 호출 함수
│   │   │   ├── axiosInstance.tsx
│   │   │   ├── auth.tsx
│   │   │   ├── user.tsx
│   │   │   ├── posts.tsx
│   │   │   ├── bookSearch.tsx
│   │   │   ├── sessions.tsx     # 세션 API
│   │   │   ├── notes.ts         # 협업 노트 API
│   │   │   ├── speakingQueue.ts # 발언 대기열 API
│   │   │   ├── aiSummary.ts     # AI 요약 API
│   │   │   └── websocket.ts     # WebSocket 클라이언트
│   │   ├── AuthContext/         # Firebase 인증 Context
│   │   │   └── AuthContext.tsx
│   │   ├── components/          # 재사용 컴포넌트
│   │   │   ├── AccountDropdown.tsx    # 계정 드롭다운 메뉴
│   │   │   ├── NavBar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   ├── SessionWarning.tsx
│   │   │   ├── meet/            # 미팅룸 컴포넌트
│   │   │   │   ├── LeftPanel/
│   │   │   │   │   └── ModeratorControls.tsx  # 모더레이터 제어 패널
│   │   │   │   ├── CenterPanel/
│   │   │   │   │   └── CollaborativeNotes.tsx # 협업 노트 에디터
│   │   │   │   ├── RightPanel/
│   │   │   │   │   └── RecordingPanel.tsx     # 녹음 & AI 요약
│   │   │   │   └── styles/
│   │   │   └── styles/
│   │   │       ├── AccountDropdown.css
│   │   │       ├── NavBar.css
│   │   │       └── ...
│   │   ├── hooks/               # Custom Hooks
│   │   │   ├── useCollaborativeEditor.ts  # Op-based 협업 에디터
│   │   │   └── useWebSocket.ts            # WebSocket 연결 관리
│   │   ├── types/               # TypeScript 타입 정의
│   │   │   ├── collaborative.ts # 협업 에디터 타입
│   │   │   └── meetRoom.ts      # 미팅룸 타입
│   │   ├── screens/             # 페이지 컴포넌트
│   │   │   ├── Home.tsx
│   │   │   ├── Board.tsx
│   │   │   ├── PostCreate.tsx
│   │   │   ├── Profile.tsx      # 프로필 페이지
│   │   │   ├── Register.tsx     # Google 회원가입 (닉네임 설정)
│   │   │   ├── SetUsername.tsx  # 기존 사용자 닉네임 변경
│   │   │   ├── Login.tsx
│   │   │   ├── About.tsx
│   │   │   ├── MeetRoom.tsx     # 실시간 미팅룸 (3 패널 레이아웃)
│   │   │   └── styles/
│   │   │       ├── Profile.css
│   │   │       ├── Board.css
│   │   │       ├── MeetRoom.css
│   │   │       └── ...
│   │   ├── language/            # 다국어 지원
│   │   │   ├── i18n.tsx
│   │   │   ├── en.tsx
│   │   │   └── ko.tsx
│   │   └── App.tsx
│   └── .env                     # Firebase 설정
│
└── backend/                     # Spring Boot
    └── src/main/java/com/bookclub/backend/
        ├── config/              # Security, CORS, Swagger 설정
        ├── firebase/            # Firebase 초기화 및 인증 필터
        ├── user/                # 사용자 관리
        ├── post/                # 게시판/모임
        ├── messages/            # 1:1 메시징
        ├── ISBNAPI/             # 도서 검색
        ├── googleapi/           # Google Calendar/Meet 통합
        ├── session/             # 세션, 발언 대기열, 협업 노트, 녹음/요약
        │   ├── model/
        │   │   ├── SpeakingQueue.java      # 발언 대기열 모델
        │   │   ├── SessionNote.java        # 협업 노트 모델 (공용)
        │   │   ├── UserSessionNote.java    # 개인 토론 노트 모델 (fork된)
        │   │   └── SessionRecording.java   # 녹음 & AI 요약 모델
        │   ├── controller/
        │   │   ├── SessionNoteController.java
        │   │   ├── UserSessionNoteController.java  # 개인 노트 API
        │   │   ├── SpeakingQueueController.java
        │   │   └── AISummaryController.java
        │   ├── service/
        │   │   ├── SessionNoteService.java
        │   │   ├── UserSessionNoteService.java   # 개인 노트 서비스
        │   │   ├── SpeakingQueueService.java
        │   │   └── SessionRecordingService.java
        │   ├── repository/
        │   ├── Session.java             # 세션 모델 (postId 연결)
        │   ├── SessionController.java   # 세션 참가/조회 API
        │   └── SessionService.java
        ├── openai/              # OpenAI GPT 통합
        │   ├── dto/             # API 요청/응답 모델
        │   ├── OpenAiClient.java     # OpenAI API 클라이언트
        │   ├── OpenAIConfig.java     # API 키 설정
        │   └── OpenAIService.java    # AI 요약 생성 로직
        └── websocket/           # WebSocket 설정 및 핸들러
            ├── WebSocketConfig.java        # STOMP 설정
            ├── WebSocketAuthInterceptor.java # 토큰 검증
            ├── WebSocketPrincipal.java
            └── DocEditController.java      # Op-based 협업 편집 핸들러
```

---

## 프론트엔드 라우트

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Home | 홈 페이지 |
| `/board` | Board | 게시판 (모임 목록) |
| `/board/create` | PostCreate | 토론방 만들기 |
| `/meet/:sessionId` | MeetRoom | 실시간 미팅룸 (3 패널 레이아웃) |
| `/profile` | Profile | 프로필 페이지 |
| `/register` | Register | Google 회원가입 (닉네임 설정 후 DB 저장) |
| `/set-username` | SetUsername | 기존 사용자 닉네임 변경 |
| `/login` | Login | 로그인 페이지 |
| `/about` | About | 소개 페이지 |
| `/notes` | Notes | 개인 토론 노트 목록 페이지 |
| `/notes/:noteId` | NoteDetail | 개인 토론 노트 상세/편집 페이지 |

---

## 인증 시스템

### Firebase Authentication 기반 인증 흐름

```
[클라이언트]                           [서버]
1. Firebase signInWithPopup()
   → Google/Email 로그인
2. Firebase ID Token 발급
3. API 요청 시 Authorization 헤더에 토큰 포함
                                    4. FirebaseAuthFilter가 토큰 검증
                                    5. 검증 성공 시 API 접근 허용
```

### Google 회원가입 흐름 (신규 사용자)

```
[Google 로그인 클릭]
        ↓
[Firebase signInWithPopup() 성공]
        ↓
[handleGoogleLogin: 신규 사용자 감지]
        ↓
[pendingGoogleUser 상태에 저장] ← DB 저장 안함
[isGoogleRegistrationPendingRef = true]
        ↓
[/register 페이지로 리다이렉트]
        ↓
[닉네임 입력 + 중복/비속어 검사]
        ↓
["가입 완료" 버튼 클릭]
        ↓
[completeGoogleRegistration(username)]
        ↓
[DB에 사용자 저장] → 로그인 완료
```

**핵심 포인트:**
- Google 로그인 성공 시 신규 사용자는 바로 DB에 저장되지 않음
- `pendingGoogleUser` 상태에 임시 저장 후 `/register`로 이동
- 닉네임 설정 완료 후 "가입 완료" 버튼 클릭 시에만 DB 저장
- `isGoogleRegistrationPendingRef`로 `onAuthStateChanged`의 자동 등록 방지

### 주요 파일
- `frontend/src/AuthContext/AuthContext.tsx` - Firebase 인증 Context
- `frontend/src/screens/Register.tsx` - Google 회원가입 페이지
- `backend/.../firebase/FirebaseConfig.java` - Firebase 초기화
- `backend/.../firebase/FirebaseAuthFilter.java` - 토큰 검증 필터
- `backend/.../config/SecurityConfig.java` - Spring Security 설정

---

## 개발 완료 기능 (MVP v1.0)

### 사용자 관리 (User)

| 기능 | 설명 |
|------|------|
| Google 회원가입 | Firebase Auth → 닉네임 설정 → MongoDB 저장 (2단계) |
| 이메일 회원가입 | Firebase Auth + MongoDB 저장 (1단계) |
| Google 로그인 | Firebase signInWithPopup (기존 사용자) |
| 이메일 로그인 | Firebase signInWithEmailAndPassword |
| 사용자 프로필 | uid, email, username, rating, friends, photoUrl 등 |

**User 모델 (MongoDB)**
```java
@Document(collection = "user")
public class User {
    @Id
    private String id;
    private String uid;                           // Firebase UID
    private String email;
    private String username;
    private String password;
    private int rating;                           // 평판 점수
    private int absent;                           // 불참 횟수
    private List<String> friends;
    private int late;                             // 지각 횟수
    private int kicked;                           // 강퇴 당한 횟수
    private UserPosts posts;                      // 북미팅 관련 필드
    private String photoUrl;                      // Google 프로필 사진 URL

    // 북미팅 관련 내부 클래스
    public static class UserPosts {
        private List<String> created;             // 생성한 북미팅 ID 리스트
        private List<String> participated;        // 참여한 북미팅 ID 리스트
    }
}
```

**API 엔드포인트**
- `POST /api/users/register` - 회원가입
- `GET /api/users/{id}` - 사용자 조회
- `GET /api/users/uid/{uid}` - Firebase UID로 조회
- `GET /api/users/uid` - 토큰에서 UID 추출하여 조회
- `GET /api/users/username/{username}` - username으로 조회
- `GET /api/users/validate-username/{username}` - 닉네임 유효성 검사 (중복 + 비속어)
- `POST /api/users/{userId}/add-friend/{friendId}` - 친구 추가
- `PUT /api/users/{id}` - 사용자 정보 수정
- `DELETE /api/users/{id}` - 사용자 삭제
- `POST /api/auth/logout` - 로그아웃

### 독서 모임 게시판 (Post)

| 기능 | 설명 |
|------|------|
| 모임 개설 | 책 제목, 난이도, 정원, 마감일 설정 |
| Google Meet 자동 생성 | 모임 생성 시 Meet 링크 자동 발급 |
| 자동 새로고침 | 30초 주기 폴링 + 액션 후 즉시 갱신 |
| 난이도 필터링 | low/moderate/high |

**API 엔드포인트**
- `POST /api/posts` - 모임 생성 (Meet 링크 포함)
- `GET /api/posts` - 전체 모임 조회
- `GET /api/posts/{id}` - 모임 상세 조회
- `GET /api/posts/creator/{creator}` - 작성자별 조회
- `PUT /api/posts/{id}` - 모임 수정
- `DELETE /api/posts/{id}` - 모임 삭제

### 메시징 (DirectMessage)

**API 엔드포인트**
- `POST /api/messages/send` - 메시지 전송
- `GET /api/messages/between?user1={id}&user2={id}` - 대화 조회
- `GET /api/messages/inbox/{userId}` - 받은 메시지함

### 도서 검색 (ISBN)

**API 엔드포인트**
- `GET /api/ISBN/search?query={keyword}` - 도서 검색 (OpenLibrary API)

### 다국어 지원 (i18n)
- 한국어/영어 전환 지원
- i18next, react-i18next 사용
- IP 기반 자동 언어 감지
- **언어별 도서 API 분리**:
  - 한국어(KR): Naver Books API 사용, `api: 'naver'` posts만 표시
  - 영어(EN): Google Books API 사용, `api: 'google'` posts만 표시
- Post.bookData.api 필드로 도서 검색 출처 저장

### 계정 드롭다운 메뉴 (AccountDropdown)

네비게이션 바에서 사용자 아이콘 클릭 시 표시되는 드롭다운 메뉴입니다.

| 섹션 | 항목 | 설명 |
|------|------|------|
| **사용자 요약** | 프로필 사진, 닉네임, 평점 | 클릭 시 프로필 페이지로 이동 |
| **핵심 액션** | 내 프로필 | `/profile` |
| | 내가 만든 모임 | `/board?filter=created` |
| | 참여 중인 모임 | `/board?filter=participating` |
| | 새 토론 만들기 | `/board/create` (CTA 스타일) |
| **지식 & 기록** | 토론 노트 | `/notes` (준비 중) |
| | 관심 북미팅 | `/favorites` (준비 중) |
| **설정 & 관리** | 계정 설정 | `/profile#settings` |
| | 평판 & 활동 내역 | `/profile#activity` |
| **지원** | 도움말 / FAQ | `/help` (준비 중) |
| | 피드백 보내기 | `/feedback` (준비 중) |
| **시스템** | 로그아웃 | 세션 종료 및 홈으로 이동 |

**주요 파일**
- `frontend/src/components/AccountDropdown.tsx` - 드롭다운 컴포넌트
- `frontend/src/components/styles/AccountDropdown.css` - 스타일

**기능**
- Click-outside 클릭 시 메뉴 닫힘
- ESC 키 지원
- 모바일 반응형 (작은 화면에서는 아바타만 표시)
- Google 프로필 사진 표시 (이메일 사용자는 기본 아바타)

### 프로필 페이지 (Profile)

사용자 정보와 활동 내역을 확인할 수 있는 페이지입니다.

**라우트**: `/profile`

| 탭 | 내용 |
|-----|------|
| **개요** | 생성한 모임 목록, 참여 중인 모임 목록 |
| **활동** | 평점, 불참 횟수, 지각 횟수, 총 모임 수, 친구 수 |
| **설정** | 닉네임 변경, 알림 설정 (준비 중), 언어 설정 안내 |

**URL 해시 지원**
- `/profile` - 개요 탭
- `/profile#activity` - 활동 탭
- `/profile#settings` - 설정 탭

**주요 파일**
- `frontend/src/screens/Profile.tsx` - 프로필 페이지 컴포넌트
- `frontend/src/screens/styles/Profile.css` - 스타일

### 토론 요약 노트 페이지 (Notes)

사용자가 참여한 토론의 AI 생성 요약을 탐색하고 관리하는 페이지입니다.

**라우트**: `/notes`

| 기능 | 설명 |
|------|------|
| 요약 목록 | 사용자가 참여한 모든 토론의 AI 요약 표시 |
| 그리드/리스트 뷰 | 뷰 모드 전환 지원 |
| 검색 | 책 제목, 저자, 호스트 이름으로 검색 |
| 필터 | 전체/최근 30일/즐겨찾기 탭 |
| 정렬 | 최신순/참가자 많은순/토론 시간순 |
| 반응형 | 모바일/태블릿/데스크톱 지원 |

**API 엔드포인트**
- `GET /api/sessions/my-summaries` - 사용자의 모든 토론 요약 조회

**주요 파일**
- `frontend/src/screens/Notes.tsx` - 노트 페이지 컴포넌트
- `frontend/src/screens/styles/Notes.css` - 스타일
- `frontend/src/api/aiSummary.ts` - API 호출 (getMySummaries)
- `backend/.../session/dto/NoteSummaryResponse.java` - 응답 DTO

---

## 실시간 미팅룸 시스템 (MVP v1.5)

### 전체 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                         MeetRoom (React)                          │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Left Panel   │  │  Center Panel   │  │   Right Panel      │  │
│  │              │  │                 │  │                    │  │
│  │ Moderator    │  │ Collaborative   │  │ Recording &        │  │
│  │ Controls     │  │ Notes (TipTap)  │  │ AI Summary         │  │
│  │              │  │                 │  │                    │  │
│  │ - Meet Link  │  │ - Rich Editor   │  │ - Toggle Record    │  │
│  │ - Queue      │  │ - Op-based CRDT │  │ - Generate Summary │  │
│  │ - Raise Hand │  │ - Presence      │  │ - Insert to Notes  │  │
│  └──────────────┘  └─────────────────┘  └────────────────────┘  │
└────────────┬──────────────┬──────────────────┬───────────────────┘
             │              │                  │
        WebSocket       WebSocket          REST API
     (Speaking Queue) (Doc Editing)     (AI Summary)
             │              │                  │
┌────────────┴──────────────┴──────────────────┴───────────────────┐
│                    Spring Boot Backend                            │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ Speaking Queue  │  │ Doc Edit         │  │ AI Summary      │ │
│  │ Service         │  │ Controller       │  │ Controller      │ │
│  │                 │  │ (Op Relay)       │  │ (OpenAI)        │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              MongoDB Collections                           │  │
│  │  - sessions           - speaking_queues                    │  │
│  │  - session_notes      - session_recordings                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 세션 시스템 (Session)

**라우트**: `/meet/:sessionId`

세션은 Post와 1:1로 연결되며, 실시간 토론의 라이프사이클을 관리합니다.

#### Session 모델 (MongoDB)
```java
@Document(collection = "sessions")
public class Session {
    @Id
    private String id;                  // Session ID (= sessionId)
    private String postId;              // 연결된 Post ID
    private String status;              // "live", "ended", "scheduled"
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
}
```

#### 핵심 흐름

```
사용자가 Board에서 "Join" 클릭
        ↓
POST /api/sessions/join { postId }
        ↓
SessionService: Post 권한 검증 (member 또는 creater)
        ↓
기존 live Session 조회
  ├─ 있으면: 재사용
  └─ 없으면: 새로 생성 (Session.postId = Post.id)
        ↓
응답: { sessionId, status, meetLink }
        ↓
navigate(`/meet/${sessionId}`)
```

#### API 엔드포인트
- `POST /api/sessions/join` - 세션 참가 또는 생성 (권한 검증)
- `GET /api/sessions/{sessionId}` - 세션 조회 (Post 정보 포함)

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/session/Session.java` - 세션 모델
- `backend/src/main/java/com/bookclub/backend/session/SessionService.java` - 세션 로직
- `frontend/src/api/sessions.tsx` - 세션 API 호출
- `frontend/src/screens/MeetRoom.tsx` - 미팅룸 메인 화면

---

### 발언 대기열 (Speaking Queue)

순서 있는 토론을 위한 발언 관리 시스템입니다. 모더레이터(호스트)가 발언 순서를 제어합니다.

#### SpeakingQueue 모델 (MongoDB)
```java
@Document(collection = "speaking_queues")
public class SpeakingQueue {
    @Id
    private String id;
    private String sessionId;
    private String moderatorId;          // 현재 사회자의 userId (위임 가능)

    // 현재 발언자
    private CurrentSpeaker currentSpeaker;

    // 발언 대기 목록
    private List<QueuedParticipant> queue;

    // 전체 참여자
    private List<SessionParticipant> participants;

    // 내부 클래스들
    public static class CurrentSpeaker {
        private String odUserId;
        private String username;
        private String photoUrl;
        private LocalDateTime startedAt;
        private int speakingTimeSeconds;  // 기본 180초 (3분)
    }

    public static class QueuedParticipant {
        private String odUserId;
        private String username;
        private String photoUrl;
        private LocalDateTime queuedAt;
        private int position;
    }

    public static class SessionParticipant {
        private String odUserId;
        private String username;
        private String photoUrl;
        private boolean isHost;
        private boolean hasRaisedHand;
        private boolean isOnline;
        private LocalDateTime joinedAt;
    }
}
```

#### 주요 기능

| 기능 | 설명 | 권한 |
|------|------|------|
| 손 들기/내리기 | 발언 의사 표시 (toggle) | 모든 참여자 |
| 다음 발언자 | queue에서 첫 번째를 currentSpeaker로 이동 | 모더레이터만 |
| 대기열에서 제거 | 특정 참여자를 queue에서 제거 | 모더레이터만 |
| 발언 시간 표시 | currentSpeaker.startedAt 기준 실시간 카운터 | 모든 참여자 |
| 사회자 위임 | 다른 참여자에게 사회자 권한 이전 | 모더레이터만 |
| 사회자 표시 | 참여자 목록에서 현재 사회자 옆에 배지 표시 | 자동 |

#### WebSocket 실시간 동기화

```
클라이언트: raiseHand() 클릭
    ↓
POST /api/sessions/{sessionId}/queue/raise-hand
    ↓
SpeakingQueueService.raiseHand()
  - participants[].hasRaisedHand 토글
  - queue에 추가/제거
    ↓
WebSocket broadcast → /topic/session/{sessionId}/queue
    ↓
모든 클라이언트의 queue 상태 동기화
```

#### 사회자 위임 흐름

```
현재 사회자: 참가자 목록에서 위임 버튼 클릭
    ↓
POST /api/sessions/{sessionId}/queue/delegate-moderator
    ↓
SpeakingQueueService.delegateModerator()
  - 대상이 참가자인지 검증
  - queue.moderatorId = newModeratorId
    ↓
WebSocket broadcast → /topic/session/{sessionId}/queue
    ↓
모든 클라이언트:
  - isHost 재계산 (queue.moderatorId 기준)
  - 참가자 목록에 사회자 배지 업데이트
  - 이전 사회자: 권한 UI 숨김
  - 새 사회자: 권한 UI 표시
```

#### API 엔드포인트
- `GET /api/sessions/{sessionId}/queue` - 대기열 조회
- `POST /api/sessions/{sessionId}/queue/raise-hand` - 손 들기/내리기
- `POST /api/sessions/{sessionId}/queue/next-speaker` - 다음 발언자 (모더레이터만)
- `POST /api/sessions/{sessionId}/queue/remove` - 대기열에서 제거 (모더레이터만)
- `POST /api/sessions/{sessionId}/queue/delegate-moderator` - 사회자 위임 (모더레이터만)

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/session/model/SpeakingQueue.java` - 모델
- `backend/src/main/java/com/bookclub/backend/session/service/SpeakingQueueService.java` - 비즈니스 로직
- `frontend/src/components/meet/LeftPanel/ModeratorControls.tsx` - UI 컴포넌트
- `frontend/src/api/speakingQueue.ts` - API 호출

---

### 협업 노트 (Collaborative Notes)

TipTap 기반 리치 에디터로, **Op-based CRDT** 방식을 사용하여 실시간 동시 편집을 지원합니다.

#### SessionNote 모델 (MongoDB)
```java
@Document(collection = "session_notes")
public class SessionNote {
    @Id
    private String id;
    private String sessionId;
    private String content;         // TipTap JSON 형식
    private int version;            // 충돌 방지용 버전
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String lastEditedBy;    // 마지막 편집자 username
}
```

#### Op-based CRDT 아키텍처

**핵심 원칙:**
1. **Stateless Server**: 서버는 상태를 저장하지 않고, 연산(operation)만 중계
2. **Step-based Sync**: 문서 전체가 아닌 변경 단위(step)만 전송
3. **Optimistic UI**: 로컬 편집은 즉시 반영, 원격 step은 비동기 적용
4. **Debounced Send**: 연속 입력을 배치로 묶어 전송 (50ms)

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 A: "Hello" 입력                                          │
│    ↓                                                             │
│  TipTap Transaction 생성                                         │
│    ↓                                                             │
│  Step 추출: { from: 0, to: 0, slice: "Hello" }                  │
│    ↓                                                             │
│  pendingSteps에 추가 (debounce 50ms)                             │
│    ↓                                                             │
│  WebSocket 전송: /app/docs/{docId}/edit                         │
│    ↓                                                             │
│  DocEditController: 그대로 relay                                 │
│    ↓                                                             │
│  Broadcast: /topic/docs/{docId}/edit                            │
│    ↓                                                             │
│  사용자 B: step 수신 → 로컬 적용 (커서 유지)                     │
└─────────────────────────────────────────────────────────────────┘
```

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 리치 텍스트 편집 | Bold, Italic, Heading, List, Quote, Code 등 |
| 실시간 동시 편집 | 여러 사용자가 동시 편집, 충돌 자동 해결 |
| Presence 표시 | 활성 편집자 아바타 표시 (자기 자신 포함, 최대 4명 + 더보기) |
| 프로필 사진 표시 | presence-avatars에 사용자 photoUrl 표시 (없으면 기본 아이콘) |
| 자동 저장 | 2초 debounce 후 MongoDB에 저장 |
| 연결 상태 표시 | WiFi 아이콘으로 WebSocket 연결 상태 표시 |
| 동기화 상태 | "Syncing..." / "Synced" 표시 |
| 새로고침 대응 | 같은 userId로 재접속 시 기존 세션 자동 정리 (중복 방지) |

#### WebSocket Topics

| Topic | 방향 | 용도 |
|-------|------|------|
| `/app/docs/{docId}/edit` | Client → Server | Step 전송 |
| `/topic/docs/{docId}/edit` | Server → Clients | Step broadcast |
| `/app/docs/{docId}/presence` | Client → Server | 커서 위치 전송 |
| `/topic/docs/{docId}/presence` | Server → Clients | Presence broadcast |
| `/app/docs/{docId}/join` | Client → Server | 입장 알림 |
| `/topic/docs/{docId}/users` | Server → Clients | 사용자 목록 |
| `/app/docs/{docId}/leave` | Client → Server | 퇴장 알림 |

#### API 엔드포인트
- `GET /api/sessions/{sessionId}/notes` - 노트 조회
- `POST /api/sessions/{sessionId}/notes` - 노트 생성
- `PUT /api/sessions/{sessionId}/notes` - 노트 수정 (DB 저장)

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/session/model/SessionNote.java` - 모델
- `backend/src/main/java/com/bookclub/backend/websocket/DocEditController.java` - Op 중계
- `frontend/src/components/meet/CenterPanel/CollaborativeNotes.tsx` - UI 컴포넌트
- `frontend/src/hooks/useCollaborativeEditor.ts` - Op-based 로직
- `frontend/src/types/collaborative.ts` - 타입 정의

---

### 녹음 및 AI 요약 (Recording & AI Summary)

OpenAI GPT-4o-mini를 사용하여 토론 노트를 자동 요약하는 기능입니다.

#### SessionRecording 모델 (MongoDB)
```java
@Document(collection = "session_recordings")
public class SessionRecording {
    @Id
    private String id;
    private String sessionId;

    // 녹음 상태
    private boolean isRecording;
    private LocalDateTime recordingStartedAt;
    private LocalDateTime recordingEndedAt;
    private long recordingDurationSeconds;

    // AI 요약
    private AISummary aiSummary;

    public static class AISummary {
        private String oneLiner;                // 한 줄 요약
        private List<String> keyPoints;         // 핵심 논점
        private List<String> quotes;            // 인상 깊은 인용구
        private List<Agreement> agreements;     // 합의/논쟁 사항
        private List<String> openQuestions;     // 열린 질문
        private LocalDateTime generatedAt;
        private String modelUsed;               // "gpt-4o-mini"

        public static class Agreement {
            private String point;
            private boolean isAgreement;  // true: 합의, false: 논쟁
        }
    }
}
```

#### AI 요약 생성 흐름

```
모더레이터: "요약 생성" 클릭
    ↓
POST /api/sessions/{sessionId}/ai-summary
    ↓
AISummaryController:
  1. Session → Post → bookTitle 조회
  2. SessionNote → content 조회
    ↓
OpenAIService.generateSummary(bookTitle, noteContent)
    ↓
OpenAI API 호출:
  - Model: gpt-4o-mini
  - System Prompt: 다국어 지원, JSON 형식 요구
  - User Prompt: "Book Title: {title}\n\nDiscussion Notes:\n{content}"
    ↓
JSON 응답 파싱:
  {
    "oneLiner": "...",
    "keyPoints": ["...", "..."],
    "quotes": ["...", "..."],
    "agreements": [{"point": "...", "isAgreement": true}, ...],
    "openQuestions": ["...", "..."]
  }
    ↓
AISummary 객체 생성 → SessionRecording에 저장
    ↓
프론트: "노트에 삽입" 버튼 클릭
    ↓
CollaborativeNotes.insertContentAtEnd() 호출
  - TipTap JSON 형식으로 변환 (Heading, List, Blockquote 등)
  - 에디터 끝에 삽입
```

#### 주요 기능

| 기능 | 설명 | 권한 |
|------|------|------|
| 녹음 토글 | 녹음 시작/종료 (실제 음성 녹음은 미구현) | 모더레이터만 |
| AI 요약 생성 | 노트 내용 기반 GPT 요약 | 모더레이터만 |
| 노트에 삽입 | 요약을 협업 노트 끝에 자동 삽입 | 모더레이터만 |
| 다국어 요약 | 노트 언어에 맞춰 요약 (한국어/영어) | 자동 감지 |

#### Fallback 동작
- **API 키 없음**: Mock 요약 반환 (서버 시작 시 경고 로그)
- **노트 내용 부족** (< 50자): Mock 요약 반환
- **OpenAI API 오류**: Mock 요약 반환

#### API 엔드포인트
- `GET /api/sessions/{sessionId}/recording` - 녹음 상태 및 요약 조회
- `POST /api/sessions/{sessionId}/recording/toggle` - 녹음 토글 (모더레이터만)
- `POST /api/sessions/{sessionId}/ai-summary` - AI 요약 생성 (모더레이터만)
- `GET /api/sessions/{sessionId}/export/markdown` - 노트 Markdown 변환 (준비 중)

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/session/model/SessionRecording.java` - 모델
- `backend/src/main/java/com/bookclub/backend/openai/OpenAIService.java` - AI 로직
- `backend/src/main/java/com/bookclub/backend/openai/OpenAiClient.java` - API 클라이언트
- `backend/src/main/java/com/bookclub/backend/session/controller/AISummaryController.java` - REST API
- `frontend/src/components/meet/RightPanel/RecordingPanel.tsx` - UI 컴포넌트
- `frontend/src/api/aiSummary.ts` - API 호출

---

### 개인 토론 노트 (User Session Notes)

세션 종료 시 공용 협업 노트가 각 참가자에게 개인 복사본으로 fork되어 저장됩니다.

#### 핵심 개념

```
┌──────────────────────────────────────────────────────────────────┐
│  세션 진행 중                                                     │
│  ┌──────────────────┐                                            │
│  │  session_notes   │  ← 모든 참가자가 실시간 협업 편집           │
│  │  (공용)          │                                            │
│  └──────────────────┘                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ 세션 종료 시 fork
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  세션 종료 후                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ user_session   │  │ user_session   │  │ user_session   │     │
│  │ _notes (A)     │  │ _notes (B)     │  │ _notes (C)     │     │
│  │ 개인 수정 가능 │  │ 개인 수정 가능 │  │ 개인 수정 가능 │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

#### UserSessionNote 모델 (MongoDB)
```java
@Document(collection = "user_session_notes")
@CompoundIndexes({
    @CompoundIndex(name = "session_user_idx", def = "{'sessionId': 1, 'userId': 1}", unique = true)
})
public class UserSessionNote {
    @Id
    private String id;
    private String sessionId;      // 연결된 세션 ID
    private String userId;         // 노트 소유자 ID
    private String baseNoteId;     // 원본 session_notes._id
    private int baseVersion;       // 포크 당시 버전
    private String title;          // 노트 제목
    private String content;        // TipTap JSON 콘텐츠
    private int version;           // 개인 노트 버전
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

#### Fork 흐름

```
호스트: "종료하기" 클릭
    ↓
POST /api/posts/{id}/end
    ↓
PostController.endMeeting()
    ↓
WebSocket 브로드캐스트: /topic/session/{sessionId}/ended
    ↓
userSessionNoteService.forkNotesToParticipants(sessionId)
    ↓
각 참가자에게 개인 노트 생성:
  - session_notes 내용 복사
  - userId별 user_session_notes 생성
  - 제목: "{책 제목} 토론 노트"
    ↓
사용자: /notes 페이지에서 개인 노트 확인 & 수정
```

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 자동 Fork | 세션 종료 시 모든 참가자에게 자동 배포 |
| 개인 편집 | 각자의 노트를 자유롭게 수정 |
| 버전 추적 | 원본 노트 ID와 버전 저장 |
| 수동 Fork | 뒤늦게 요청하는 경우 수동 fork 가능 |

#### API 엔드포인트
- `GET /api/user-notes` - 내 모든 개인 노트 조회
- `GET /api/user-notes/enriched` - 미팅 컨텍스트 포함 조회
- `GET /api/user-notes/{noteId}` - 특정 노트 조회
- `GET /api/user-notes/{noteId}/enriched` - 컨텍스트 포함 조회
- `GET /api/user-notes/session/{sessionId}` - 세션별 내 노트 조회
- `PUT /api/user-notes/{noteId}/content` - 노트 내용 수정
- `PUT /api/user-notes/{noteId}/title` - 노트 제목 수정
- `DELETE /api/user-notes/{noteId}` - 노트 삭제
- `POST /api/user-notes/fork/{sessionId}` - 수동 fork

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/session/model/UserSessionNote.java` - 모델
- `backend/src/main/java/com/bookclub/backend/session/service/UserSessionNoteService.java` - 서비스
- `backend/src/main/java/com/bookclub/backend/session/controller/UserSessionNoteController.java` - REST API
- `frontend/src/screens/Notes.tsx` - 노트 목록 페이지
- `frontend/src/screens/NoteDetail.tsx` - 노트 상세/편집 페이지
- `frontend/src/api/notes.ts` - API 호출

---

### WebSocket 통합 (STOMP)

모든 실시간 기능은 STOMP 프로토콜 기반 WebSocket을 통해 동작합니다.

#### 설정 (backend/websocket/WebSocketConfig.java)

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig {
    // Broker: /topic (broadcast), /queue (개인)
    // App prefix: /app (클라이언트 → 서버)
    // User prefix: /user (개인 메시지)

    // Endpoint: /ws (SockJS fallback 지원)
    // CORS: localhost:5173 허용

    // 인증: WebSocketAuthInterceptor (Firebase 토큰 검증)
}
```

#### 주요 채널

| 목적 | Subscribe (수신) | Send (송신) |
|------|------------------|-------------|
| 발언 대기열 | `/topic/session/{sessionId}/queue` | `/app/session/{sessionId}/queue` |
| Presence | `/topic/session/{sessionId}/presence` | `/app/session/{sessionId}/presence` |
| 노트 편집 | `/topic/docs/{docId}/edit` | `/app/docs/{docId}/edit` |
| 노트 Presence | `/topic/docs/{docId}/presence` | `/app/docs/{docId}/presence` |
| 사용자 목록 | `/topic/docs/{docId}/users` | `/app/docs/{docId}/join`, `/app/docs/{docId}/leave` |

#### 연결 흐름

```
MeetRoom 마운트
    ↓
useWebSocket(sessionId) 초기화
    ↓
createWebSocketClient(accessToken)
  - URL: ws://localhost:8080/ws
  - STOMP over SockJS
  - connectHeaders: { Authorization: "Bearer {token}" }
    ↓
WebSocketAuthInterceptor: Firebase 토큰 검증
    ↓
연결 성공 → isConnected = true
    ↓
구독 시작:
  - /topic/session/{sessionId}/queue
  - /topic/session/{sessionId}/presence
  - /topic/docs/{sessionId}/edit
  - /topic/docs/{sessionId}/presence
  - /topic/docs/{sessionId}/users
    ↓
Join 메시지 전송:
  - /app/session/{sessionId}/presence
  - /app/docs/{sessionId}/join
    ↓
실시간 동기화 시작
```

**주요 파일**
- `backend/src/main/java/com/bookclub/backend/websocket/WebSocketConfig.java` - STOMP 설정
- `backend/src/main/java/com/bookclub/backend/websocket/WebSocketAuthInterceptor.java` - 인증
- `backend/src/main/java/com/bookclub/backend/websocket/DocEditController.java` - 노트 편집 핸들러
- `frontend/src/api/websocket.ts` - WebSocket 클라이언트 생성
- `frontend/src/hooks/useWebSocket.ts` - WebSocket Hook

---

## Google Meet 통합 (MVP v1.0)

### 아키텍처 개요

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌─────────┐
│  Frontend   │────▶│   Backend   │────▶│ Google Calendar  │────▶│ MongoDB │
│  (React)    │     │ (Spring)    │     │      API         │     │         │
└─────────────┘     └─────────────┘     └──────────────────┘     └─────────┘
      │                   │                      │                     │
      │ 1. POST /api/posts│                      │                     │
      │   (with token)    │                      │                     │
      │──────────────────▶│                      │                     │
      │                   │ 2. events.insert()   │                     │
      │                   │   conferenceData     │                     │
      │                   │──────────────────────▶                     │
      │                   │                      │                     │
      │                   │ 3. hangoutLink,      │                     │
      │                   │    eventId 반환      │                     │
      │                   │◀──────────────────────                     │
      │                   │                      │                     │
      │                   │ 4. Post 저장         │                     │
      │                   │   (meetLink,         │                     │
      │                   │    calendarEventId)  │                     │
      │                   │─────────────────────────────────────────────▶
      │                   │                      │                     │
      │ 5. Post 응답      │                      │                     │
      │   (meetLink 포함) │                      │                     │
      │◀──────────────────│                      │                     │
```

### OAuth/권한 모델

#### 서비스 계정 기반 (Service Account) - 현재 구현
- **주체**: 서버가 서비스 계정을 사용하여 Google API 호출
- **캘린더 소유자**: 서비스 계정 자체의 캘린더
- **장점**: 사용자별 OAuth 동의 불필요, 서버에서 일괄 관리
- **단점**: 생성된 이벤트가 사용자 개인 캘린더에 표시되지 않음

```
[서비스 계정 흐름]
1. 서버 시작 시 서비스 계정 키로 인증
2. 모임 생성 요청 수신
3. 서비스 계정 권한으로 Calendar API 호출
4. Meet 링크 생성 및 반환
```

#### 사용자 OAuth 기반 (v2.1 계획)
- 사용자가 직접 Google Calendar 권한 동의
- 생성된 이벤트가 호스트의 개인 캘린더에 표시
- 참가자 초대 기능 가능

### 필요한 Google API 범위 (Scopes)

| Scope | 용도 | 필수 여부 |
|-------|------|-----------|
| `https://www.googleapis.com/auth/calendar` | 캘린더 이벤트 생성/수정/삭제 | 필수 |
| `https://www.googleapis.com/auth/calendar.events` | 이벤트 전용 (더 제한적) | 대안 |

### 데이터 모델

#### Post 모델 (MongoDB)
```java
@Document(collection = "posts")
public class Post {
    @Id
    private String id;
    private String creater;           // 작성자 ID
    private LocalDateTime date;       // 생성 날짜
    private LocalDateTime due;        // 모임 시간
    private int capacity;             // 정원
    private List<String> member;      // 참가자 목록
    private String level;             // 난이도
    private String book;              // 책 제목

    // Google Meet 관련 필드
    private String meetLink;          // Google Meet 링크
    private String calendarEventId;   // Calendar 이벤트 ID (수정/삭제용)
}
```

### 보안 고려사항

#### 토큰/키 관리
```
┌─────────────────────────────────────────────────────────────┐
│  [주의] 절대 커밋하지 말 것                                 │
│  - backend/src/main/resources/google-credentials.json      │
│  - backend/src/main/resources/serviceAccountKey.json       │
│  - .env 파일 (API 키 포함)                                  │
└─────────────────────────────────────────────────────────────┘
```

| 항목 | 처리 방식 |
|------|-----------|
| 서비스 계정 키 | 서버 파일시스템에만 저장, .gitignore에 등록 |
| Firebase ID Token | 클라이언트 → 서버, Authorization 헤더로 전송 |
| Google API 호출 | 서버에서만 수행 (클라이언트 직접 호출 금지) |
| Meet 링크 | DB에 저장 후 인증된 사용자에게만 노출 |

#### API 보안
- 모든 `/api/posts` 엔드포인트는 Firebase 인증 필요
- Meet 링크는 로그인한 사용자에게만 표시
- 서비스 계정 권한 최소화 (Calendar API만)

### 실패 케이스 및 예외 처리

| 상황 | 처리 방법 |
|------|-----------|
| 서비스 계정 키 없음 | 서버 시작 시 예외, 명확한 에러 메시지 |
| Google API 할당량 초과 | 429 에러 반환, 재시도 로직 (지수 백오프) |
| 이벤트 생성 실패 | Post 생성은 성공, meetLink = null, 에러 로깅 |
| 네트워크 오류 | 3회 재시도 후 실패 시 meetLink = null |
| 잘못된 시간 형식 | 400 Bad Request 반환 |

#### 에러 응답 예시
```json
{
  "id": "abc123",
  "book": "클린 코드",
  "meetLink": null,
  "meetError": "Google Calendar API quota exceeded. Please try again later."
}
```

### MVP 범위 (v1.0)

#### 포함
- ✅ 모임 생성 시 Meet 링크 1회 발급
- ✅ 생성된 링크를 Post에 저장
- ✅ 프론트엔드에서 "Join Meet" 버튼 표시
- ✅ 서비스 계정 기반 서버 측 API 호출

#### 미포함 (v2.1 예정)
- ❌ 모임 수정 시 이벤트 동기화
- ❌ 모임 삭제 시 이벤트 삭제
- ❌ 참가자 자동 초대
- ❌ 사용자별 OAuth 동의 및 개인 캘린더 연동
- ❌ 캘린더 알림/리마인더 설정

---

## 개발 중/계획 기능 (MVP v2.0+)

### 평판 시스템 (P0)
- 토론 후 상호 평가
- rating, absent, late 기반 신뢰도 점수
- 악성 사용자 제재

### AI 토론 사회자 (P1)
- OpenAI GPT-4 API 통합
- 책 내용 기반 질문 생성
- 실시간 음성 인식 (Whisper API)

### 실제 녹음 기능 (v2.0)
- ✅ 녹음 상태 토글 UI (완료)
- ❌ 실제 오디오 녹음 (MediaRecorder API)
- ❌ 오디오 파일 저장 (S3/CloudStorage)
- ❌ Whisper API 음성 → 텍스트 변환

### AI 요약 고도화 (v2.0)
- ✅ 기본 요약 (oneLiner, keyPoints, quotes 등) - 완료
- ❌ 토론 내용 자동 전사 (음성 녹음 연동)
- ❌ PDF/Markdown 내보내기 (다운로드)
- ❌ 이메일 전송 기능

### Google Meet 동기화 (v2.1)
- 모임 수정 시 Calendar 이벤트 업데이트
- 모임 삭제 시 Calendar 이벤트 삭제
- 사용자 OAuth 기반 개인 캘린더 연동

### 협업 노트 고도화 (v2.1)
- ✅ Op-based CRDT 실시간 동기화 - 완료
- ✅ Presence 아바타에 프로필 사진 표시 - 완료
- ✅ 자기 자신 포함 편집자 카운트 - 완료
- ✅ 새로고침 시 중복 세션 방지 - 완료
- ❌ 원격 커서 시각화 (Tiptap Collaboration Cursor)
- ❌ 버전 히스토리 (되돌리기)
- ❌ 댓글/스레드 기능

### 발언 대기열 고도화 (v1.6)
- ✅ 사회자 위임 기능 - 완료
- ✅ 사회자 배지 표시 - 완료

---

## 프로젝트 구동 방법

### 사전 요구사항
- Java 17+
- Node.js 18+
- MongoDB Atlas 계정
- Firebase 프로젝트
- Google Cloud 프로젝트 (Calendar API 활성화)

### 1. Google Cloud 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 라이브러리**에서 "Google Calendar API" 활성화
4. **API 및 서비스 > 사용자 인증 정보**에서 서비스 계정 생성
5. 서비스 계정 키(JSON) 다운로드
6. `backend/src/main/resources/google-credentials.json`으로 저장

### 2. Backend 실행

```bash
cd backend

# 빌드 (테스트 제외)
./gradlew build -x test

# 실행
./gradlew bootRun
```

- API 서버: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui/index.html

### 3. Frontend 실행

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
```

- 개발 서버: http://localhost:5173

### 4. 환경 변수 설정

**frontend/.env**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**backend/src/main/resources/application.properties**
```properties
# MongoDB
spring.data.mongodb.uri=mongodb+srv://user:pass@cluster.mongodb.net/
spring.data.mongodb.database=bookclub

# Google Calendar API
google.credentials.path=classpath:google-credentials.json
google.calendar.application-name=BookClub
google.calendar.impersonate-user=your-email@gmail.com

# OpenAI API
openai.api.key=sk-proj-your-api-key-here
openai.model=gpt-4o-mini

# Google API (Perspective API - 비속어 검사)
google.api.key=your-google-api-key
```

**backend/src/main/resources/serviceAccountKey.json**
- Firebase Console > 프로젝트 설정 > 서비스 계정에서 다운로드

**backend/src/main/resources/google-credentials.json**
- Google Cloud Console > 서비스 계정 > 키 생성에서 다운로드

### 5. 주의사항

- CORS: `localhost:5173`만 허용 (SecurityConfig.java)
- Firebase 서비스 계정 키 파일 필수
- Google 서비스 계정 키 파일 필수
- MongoDB Atlas Network Access에 IP 허용 설정 필요
- `.gitignore`에 모든 키 파일 등록 확인

---

## 트러블슈팅

### Google Calendar API 관련

| 에러 | 원인 | 해결 |
|------|------|------|
| `Invalid credentials` | 서비스 계정 키 파일 없음 | google-credentials.json 확인 |
| `Calendar API has not been used` | API 미활성화 | Google Cloud Console에서 활성화 |
| `Quota exceeded` | 일일 요청 한도 초과 | 잠시 후 재시도 또는 할당량 증가 요청 |
| `conferenceData null` | conferenceDataVersion 누락 | API 호출 시 version=1 추가 |

### Firebase 관련

| 에러 | 원인 | 해결 |
|------|------|------|
| `Firebase app not initialized` | serviceAccountKey.json 없음 | 파일 경로 확인 |
| `Token verification failed` | 만료된 토큰 | 클라이언트에서 토큰 갱신 |

### WebSocket 관련

| 에러 | 원인 | 해결 |
|------|------|------|
| `Cannot connect to WebSocket` | CORS 설정 또는 토큰 오류 | WebSocketConfig CORS 확인, 토큰 재발급 |
| `Connection refused` | 백엔드 서버 미실행 | localhost:8080 확인 |
| `Disconnected` 반복 | WebSocketAuthInterceptor 인증 실패 | 로그아웃 후 재로그인 |
| 노트가 동기화 안됨 | WebSocket 연결 끊김 | 새로고침 또는 재접속 |
| Step apply failed | 충돌 발생 | 자동 해결 실패 시 페이지 새로고침 |
| 새로고침 시 편집자 수 증가 | 이전 세션 미정리 | 자동 처리됨 (같은 userId 세션 정리) |

### OpenAI API 관련

| 에러 | 원인 | 해결 |
|------|------|------|
| `OpenAI API Key is not configured` | API 키 미설정 | application.properties에 openai.api.key 추가 |
| `401 Unauthorized` | 잘못된 API 키 | OpenAI 대시보드에서 키 확인 |
| `429 Rate Limit` | API 할당량 초과 | 요금제 확인 또는 잠시 후 재시도 |
| Mock 요약 반환됨 | API 키 없음 또는 노트 내용 부족 | API 키 설정, 노트 50자 이상 작성 |
| JSON 파싱 오류 | GPT 응답 형식 오류 | Fallback 요약 반환됨 (로그 확인) |

---

## 미팅룸 사용 가이드

### 일반 참여자

1. **Board에서 "Join" 클릭** → 자동으로 세션 생성/참가
2. **"Join Google Meet" 클릭** → 화상회의 참여
3. **손 들기** → "Raise Hand" 버튼 클릭 (발언 대기열에 추가)
4. **협업 노트 작성** → 중앙 패널에서 자유롭게 메모
5. **다른 참여자 확인** → 좌측 패널 "Participants" 섹션

### 모더레이터 (호스트)

1. **발언 순서 제어**
   - "Next Speaker" 클릭 → 대기열 첫 번째를 현재 발언자로 이동
   - 발언자 우측 X 버튼 → 대기열에서 제거
2. **사회자 위임**
   - 참가자 목록에서 위임할 사용자 옆의 위임 버튼(체크 아이콘) 클릭
   - 해당 사용자에게 모든 사회자 권한 이전
   - 위임된 사용자 옆에 "사회자/Moderator" 배지 표시
3. **녹음 관리** (우측 패널)
   - "Start Recording" 클릭 → 녹음 상태 표시 (실제 녹음은 미구현)
4. **AI 요약 생성** (우측 패널)
   - "Generate AI Summary" 클릭 → GPT-4o-mini가 노트 분석
   - 2-5초 대기 → 요약 결과 표시
   - "Insert to Notes" 클릭 → 협업 노트 끝에 자동 삽입
5. **세션 종료**
   - 좌상단 "← Back" 클릭 → Board로 복귀
