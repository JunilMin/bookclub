# bookclub

### Dev Rule

1. 주요 브랜치
    main (또는 master): 최종 제품으로 배포될 안정적인 코드가 들어있는 브랜치입니다. 배포 가능한 상태의 코드만 main에 머지됩니다.
    develop: 개발 진행 중인 코드가 모이는 브랜치입니다. 새로운 기능이나 버그 수정이 끝나면 이 브랜치로 머지합니다. 개발 단계에서 안정화된 버전이 main으로 병합됩니다.

2. 기능별 브랜치 (Feature Branch)
    새로운 기능을 개발할 때 사용하는 브랜치입니다. develop 브랜치에서 분기해서 기능을 구현한 후, 완료되면 다시 develop 브랜치에 병합합니다.
    이름 규칙: feature/기능이름
    예: feature/user-login

3. 버그 수정 브랜치 (Bugfix Branch)
    버그를 수정하는 브랜치로, develop 브랜치에서 분기합니다. 버그 수정이 끝나면 develop 브랜치에 병합됩니다.
    이름 규칙: bugfix/버그이름
    예: bugfix/fix-header-ui

4. 핫픽스 브랜치 (Hotfix Branch)
    프로덕션에 문제가 생겼을 때 긴급하게 수정하는 브랜치입니다. main 브랜치에서 분기하여 수정 후, main과 develop 브랜치에 병합합니다.
    이름 규칙: hotfix/수정이름
    예: hotfix/security-patch

5. 릴리즈 브랜치 (Release Branch)
    배포 전, 최종 준비를 하는 브랜치입니다. 버그 수정, 작은 기능 조정 등을 거쳐 배포를 위한 마지막 작업을 진행한 후, main과 develop에 병합합니다.
    이름 규칙: release/버전번호
    예: release/1.0.0

6. 실행 방법 예시
    새로운 기능 브랜치 생성:
    bash
    Copy code
    git checkout -b feature/user-login develop
    브랜치 병합: 기능 개발이 완료된 후 develop 브랜치에 병합할 때:
    bash
    Copy code
    git checkout develop
    git merge feature/user-login

7. 브랜치 보호 규칙 (Branch Protection Rules)
    Git에서 브랜치 보호 규칙을 사용하면 실수로 중요한 브랜치에 잘못된 코드가 머지되지 않도록 할 수 있습니다. GitHub 등에서는 다음과 같은 규칙들을 설정할 수 있습니다:

    강제 푸시 금지: main 및 develop 브랜치에는 강제 푸시가 불가능하게 설정합니다.
    Pull Request 요구: 중요한 브랜치에 머지하려면 반드시 Pull Request를 통해 검토를 받아야 합니다.
    CI 통과 필수: 특정 브랜치에 코드를 머지하기 전에 CI 테스트를 통과해야 합니다.
    리뷰 요구: Pull Request를 만들 때 최소 한 명 이상의 팀원이 코드 리뷰를 해야 머지가 가능합니다.

8. 기타 추천 규칙
    작업 단위로 커밋: 작업 내용을 작은 단위로 커밋하고, 커밋 메시지를 명확하게 작성합니다.
    브랜치명 짧고 명확하게: 브랜치명은 가능한 한 짧고 명확하게 작성하여 다른 팀원이 쉽게 이해할 수 있게 합니다.
    커밋 메시지 규칙: 커밋 메시지에는 변경 사항을 간결하게 설명합니다. 예를 들어:
    makefile
    Copy code
    feat: 로그인 기능 추가
    fix: 헤더 UI 수정
    refactor: 중복된 코드 리팩토링
    이런 규칙들은 Git 워크플로우를 더 체계적으로 만들고, 협업의 효율성을 높이는 데 큰 도움이 됩니다.

### frontend

    코드 정렬: npm run format
    실행: npm run dev
    git fetch, pull 후 npm install (frontend 폴더 내에서)


### Dev Rule
    
1. Java 버전: Java 17 이상을 사용합니다.

2. 패키지 구조: 기능 기반으로 구성하며, 각각의 계층별 역할을 명확히 합니다.

3. 코드 주석: 필요한 경우 Javadoc 스타일로 주석을 작성하며, 중요한 메서드나 클래스에는 반드시 주석을 작성합니다.

4. 네이밍 컨벤션:
   클래스: PascalCase (UserController, OrderService)
   메서드: camelCase (getUser(), createOrder())
   상수: 대문자 스네이크 케이스 (MAX_SIZE, DEFAULT_TIMEOUT)
   변수 및 파라미터: camelCase (userName, orderId)

5. Spring MVC 규칙:
   컨트롤러 메서드는 @GetMapping, @PostMapping 등의 애노테이션을 사용하여 명확히 구분합니다.
   서비스 계층에서는 비즈니스 로직을 처리하고, 데이터베이스 상호작용은 레포지토리 계층에서 담당합니다.

6. 형식: 커밋 메시지는 태그: 메시지 형식으로 작성합니다. 태그는 다음과 같이 정의합니다:
    **#   feat        : 기능 (새로운 기능)
    #   fix         : 버그 (버그 수정)
    #   refactor    : 리팩토링
    #   design      : CSS 등 사용자 UI 디자인 변경
    #   comment     : 필요한 주석 추가 및 변경
    #   style       : 스타일 (코드 형식, 세미콜론 추가: 비즈니스 로직에 변경 없음)
    #   docs        : 문서 수정 (문서 추가, 수정, 삭제, README)
    #   test        : 테스트 (테스트 코드 추가, 수정, 삭제: 비즈니스 로직에 변경 없음)
    #   chore       : 기타 변경사항 (빌드 스크립트 수정, assets, 패키지 매니저 등)
    #   init        : 초기 생성
    #   rename      : 파일 혹은 폴더명을 수정하거나 옮기는 작업만 한 경우
    #   remove      : 파일을 삭제하는 작업만 수행한 경우**
   (첫 글자는 항상 소문자로 시작하고, 마침표를 사용하지 않습니다.)

7. Swagger 주소: http://localhost:8080/swagger-ui/index.html
CRUD 테스트 진행

8. Frontend 생성 전, 로컬(8080) 접속 시,
-아이디: user
-비밀번호: 백엔드 실행 후, 백엔드 로그의 password

### backend

