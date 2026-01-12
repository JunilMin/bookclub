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
| **도서 데이터** | OpenLibrary API |
| **다국어** | i18next, react-i18next |
| **화상회의** | Google Meet (via Google Calendar API) |

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
│   │   │   └── bookSearch.tsx
│   │   ├── AuthContext/         # Firebase 인증 Context
│   │   │   └── AuthContext.tsx
│   │   ├── components/          # 재사용 컴포넌트
│   │   │   ├── AccountDropdown.tsx    # 계정 드롭다운 메뉴
│   │   │   ├── NavBar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   ├── SessionWarning.tsx
│   │   │   └── styles/
│   │   │       ├── AccountDropdown.css
│   │   │       ├── NavBar.css
│   │   │       └── ...
│   │   ├── screens/             # 페이지 컴포넌트
│   │   │   ├── Home.tsx
│   │   │   ├── Board.tsx
│   │   │   ├── PostCreate.tsx
│   │   │   ├── Profile.tsx      # 프로필 페이지
│   │   │   ├── Register.tsx     # Google 회원가입 (닉네임 설정)
│   │   │   ├── SetUsername.tsx  # 기존 사용자 닉네임 변경
│   │   │   ├── Login.tsx
│   │   │   ├── About.tsx
│   │   │   └── styles/
│   │   │       ├── Profile.css
│   │   │       ├── Board.css
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
        └── googleapi/           # Google Calendar/Meet 통합
```

---

## 프론트엔드 라우트

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Home | 홈 페이지 |
| `/board` | Board | 게시판 (모임 목록) |
| `/board/create` | PostCreate | 토론방 만들기 |
| `/profile` | Profile | 프로필 페이지 |
| `/register` | Register | Google 회원가입 (닉네임 설정 후 DB 저장) |
| `/set-username` | SetUsername | 기존 사용자 닉네임 변경 |
| `/login` | Login | 로그인 페이지 |
| `/about` | About | 소개 페이지 |

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
    private List<Post> posts;
    private int rating;                           // 평판 점수
    private int absent;                           // 불참 횟수
    private List<String> friends;
    private int late;                             // 지각 횟수
    private List<String> createdBookMeetings;     // 생성한 북미팅 ID 리스트
    private List<String> participatedBookMeetings; // 참여한 북미팅 ID 리스트
    private String photoUrl;                      // Google 프로필 사진 URL
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

### 계정 드롭다운 메뉴 (AccountDropdown)

네비게이션 바에서 사용자 아이콘 클릭 시 표시되는 드롭다운 메뉴입니다.

| 섹션 | 항목 | 설명 |
|------|------|------|
| **사용자 요약** | 프로필 사진, 닉네임, 평점 | 클릭 시 프로필 페이지로 이동 |
| **핵심 액션** | 내 프로필 | `/profile` |
| | 내가 만든 모임 | `/board?filter=created` |
| | 참여 중인 모임 | `/board?filter=participating` |
| | 새 토론 만들기 | `/board/create` (CTA 스타일) |
| **설정** | 계정 설정 | `/profile#settings` |
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

### AI 토론 요약 (P1)
- 토론 내용 자동 전사
- 핵심 논점 추출
- PDF/이메일 전송

### Google Meet 동기화 (v2.1)
- 모임 수정 시 Calendar 이벤트 업데이트
- 모임 삭제 시 Calendar 이벤트 삭제
- 사용자 OAuth 기반 개인 캘린더 연동

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
