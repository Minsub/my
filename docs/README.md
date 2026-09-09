# MONO 문서 안내

MONO는 필요한 페이지와 도구를 계속 추가하는 개인 워크스페이스다. 커피·와인은 첫 모듈이며, 구성원 공유는 접근 제어 기능이다. 문서는 2026-09-08 코드 기준으로 정리했다.

## 새 에이전트의 읽기 순서

1. 루트 [AGENTS.md](../AGENTS.md): 작업 규칙, 환경 구분, 필수 확인.
2. [페이지 개발 가이드](development.md): 어떤 파일을 고치고 어떻게 검증하는가.
3. [현재 아키텍처](architecture-design.md): 실제 코드 경계·인증·트랜잭션.
4. [화면과 도메인](service-design.md): 현재 페이지, 데이터의 의미, 디자인 기준.
5. 담당 도메인: [커피 기능](home-cafe/coffee-features.md), [커피 원본 요구사항](home-cafe/DESIGN.md), [와인 동작 지침](wine-celler/skill.md), [와인 기능](wine-celler/cellar-features.md), [가계부 기능](cash-money/README.md).

[단일 HTML 페이지 추가](single-html-pages.md): 독립 HTML을 앱 안에서 재사용하는 두 번째 페이지 작성 방식.

## 운영자가 직접 설정할 때

- [처음부터 클라우드 만들기](setup/README.md): 전체 순서와 완료 기준.
- [Neon 만들기](setup/neon.md): 프로젝트·DB·연결 문자열·개발 환경.
- [Vercel 만들기](setup/vercel.md): Git 연결·환경변수·배포·도메인.
- [Google 로그인 만들기](setup/google-oauth.md): 동의 화면·클라이언트·콜백.
- [배포와 운영](deployment.md): 현재 서비스 위치, 마이그레이션, 백업, 장애 대응.
- [검증 기록](verification.md): 무엇을 실제로 확인했는가.

현재 구현 설명은 실제 파일을 가리킨다. 새 기능은 구현과 함께 해당 문서를 갱신한다. 미구현 아이디어를 현재 기능 목록에 섞지 않는다. 코드와 문서가 다르면 코드·스키마를 확인하고 차이를 수정한다.

[이관 보고서](wine-celler/migration-report.md)는 이관 당시의 수량이지 계속 유지해야 할 고정 재고가 아니다. `archive/`는 과거 자료이며 현재 시스템에 실행할 지침이 아니다. 저장소 이름 `my`, npm 패키지/MCP 서버 식별자 `daily-cellar`, DB의 `household_*`는 호환성을 위해 유지한다. 화면 이름은 MONO다.
