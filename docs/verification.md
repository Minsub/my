# 구현 검증 기록

2026-09-08, 로컬 PostgreSQL 17 및 Node.js 22.23.2에서 확인했습니다.

| 검사                  | 결과                                                 |
| --------------------- | ---------------------------------------------------- |
| ESLint / TypeScript   | 통과                                                 |
| Vitest                | 20개 통과                                            |
| Playwright            | PC 5개 + 모바일 5개 통과                             |
| Next.js 프로덕션 빌드 | 운영 환경변수 없이도 통과                            |
| 프로덕션 실행         | 미설정 준비 화면, 공개 데모 11개, API 접근 차단 확인 |
| 설정된 프로덕션 실행  | 로컬 로그인, 가족 홈, 초기 원두 11개 확인            |
| 운영 의존성 audit     | 알려진 취약점 0개                                    |

재고 마지막 한 병의 동시 소비, 같은 요청의 중복 실행 방지, 재고 부족 시 시음 롤백, 구매 이력 보존, 취소 중복 방지, 가족 분리와 권한 회수를 검사했습니다. 날짜 전용 값은 서버 시간대에 영향을 받지 않도록 보존하며 생성 시각은 한국 시간으로 표시합니다.

OAuth는 DCR → PKCE → 로그인 → 동의 → 토큰 발급 → MCP 목록/쓰기 → 갱신 → 연결 해제를 검증했습니다. 웹 브라우저에서 로그인·동의 화면을 실제 조작하는 테스트도 포함합니다. 해제 후 access token과 refresh token 사용을 거부하고 동의가 다시 생겨도 기존 토큰이 살아나지 않는 것을 검사했습니다.

화면은 PC 1440px와 iPhone 13 크기의 Chromium에서 내비게이션·검색·평가·입고·소비·취소·로그아웃, 모달 Escape 닫기, 주요 페이지 가로 넘침을 검사했습니다. 스크린샷은 테스트 실행 후 `test-results/visual/`에 저장됩니다.

Neon PostgreSQL 18 운영 DB 마이그레이션 3개 적용, 실제 Google 로그인과 관리자 가족 생성, 원두 11개 초기 등록 및 로컬 조회를 확인했습니다. 운영 데이터로 만든 Neon development 브랜치도 별도로 연결했습니다. GitHub main push 및 Vercel 첫 배포가 완료되었습니다. 운영 환경변수 적용 후 최종 검증은 아래 기록을 참고합니다.

실제 iOS Safari 기기, Claude·ChatGPT·Codex 각각의 서비스 계정 연결, 운영 Airtable 원본 이관은 아직 검증하지 않았습니다.


## 클라우드 운영 검증

- Vercel `https://my-seven-sandy.vercel.app`에 Production 환경변수 8개를 Secret으로 저장하고 배포 완료.
- Google OAuth는 Production 상태. 운영 HTTPS와 localhost 콜백 등록, 양쪽 Google 로그인 및 가족 관리자·원두 11개 조회 확인.
- 공개 `/privacy` 200, 비로그인 `/api/data`와 `/api/mcp` 401 확인.
- OAuth protected-resource / authorization-server discovery 200 및 운영 issuer·resource URL 확인.
- 운영 DCR → PKCE → 브라우저 동의 → 토큰 발급 → 읽기 전용 도구 9개 → 원두 11개 조회 → refresh 성공.
- 설정에서 시험 AI 연결 해제 후 기존 access token 401, refresh token 400 확인. 시험 연결은 해제된 상태로 마무리.
- 로컬 `.env.local`은 Neon development를 사용하며 운영과 서명 secret도 분리. 복제된 로그인 세션과 서명키는 개발 브랜치에서만 제거하고 다시 로그인하여 확인.
- 개인정보 안내 추가 후 ESLint·TypeScript·Node 22 프로덕션 빌드 통과.

실제 AI 제품별 연결은 위 프로토콜 검증과 별개이며 Claude·ChatGPT·Codex 각각의 계정으로 연결해야 합니다.
