# 페이지 추가·수정 작업 가이드

## 1. 작업 시작

1. 루트 AGENTS.md, docs/README.md, architecture-design.md, service-design.md와 담당 도메인 문서를 읽는다.
2. `git status --short`로 기존 변경을 확인한다. 환경 파일은 내용을 출력하지 말고 필요한 키 존재 여부와 DB host/DB명만 확인한다.
3. Node 22.x와 `npm ci`를 사용한다. 새 checkout의 의존성 설치는 lockfile을 바꾸지 않는다. `.nvmrc`를 적용한다.
4. 현재 Next.js API는 `node_modules/next/dist/docs/`에서 관련 가이드를 읽는다. 설치된 라이브러리 버전과 코드를 기준으로 한다.
5. UI만 보는 경우 `npm run dev` 후 `/demo`로 시작할 수 있다. 실제 개발 DB가 필요하면 [Neon 가이드](setup/neon.md) 또는 README의 Docker 개발 환경을 준비한다.

## 2. 기존 페이지 변경

- 검색: `rg -n 'renderWine|renderCoffee|renderSettings|const nav' src/components/app-shell.tsx`.
- 가계부는 cash-dashboard.tsx/cash-detail.tsx/cash-files.tsx와 전용 API·서버 서비스, 홈은 workspace-home.tsx, 와인 목록은 wine-cellar.tsx, MCP 안내는 mcp-guide.tsx / lib/mcp-guide.ts다. 기존 app-shell.tsx를 더 크게 만들기보다 변경할 화면을 별도 컴포넌트로 분리한다.
- AppShell의 `data`, `href`, `reload`, `save`, 폼 열기 함수를 재사용하거나 명시적인 props로 전달한다. 컴포넌트가 임의로 다른 사용자 데이터를 가져오지 않는다.
- 상품 수정은 `expected_version`, 모든 공통 변경은 `idempotency_key`가 필요하다. FormSpec/RecordForm과 기존 오류 처리 흐름을 읽고 사용한다.
- 목록 조회의 실제 의미를 바꾸면 웹과 MCP를 같이 확인한다. 와인 가격·필터는 lib/wine-cellar.ts가 공통 기준이다.

## 3. 새 페이지: 기존 도메인 안에 추가

예: `/coffee/history`를 추가한다면 다음 연결점이 모두 필요하다. 아래 경로는 예시이며 현재 제공하는 페이지가 아니다.

1. `src/components/coffee-history.tsx`에 화면을 만든다. 서버 모듈을 client component에 import하지 않는다.
2. `src/app/(family)/[[...path]]/page.tsx`의 허용 경로에 추가한다. 현재 catch-all은 알 수 없는 경로를 404 처리한다.
3. `src/components/app-shell.tsx`의 content 분기에 연결하고 필요하면 도메인 탭/메뉴를 추가한다. 기존 `href()`로 demo URL도 처리한다.
4. 기존 Snapshot으로 가능한 조회면 스키마 변경 없이 활용한다. 새 조회가 필요하면 서버에서 동일 Actor/공간/권한을 적용한다.
5. `src/app/demo/page.tsx`의 view 전달과 `src/lib/demo.ts`를 확인한다. 데모에서 실제 API를 호출하거나 저장을 허용하지 않는다.
6. 관련 페이지의 모바일/PC 이동, 404, 빈 상태, 저장 후 갱신을 확인한다.

기존 흐름을 유지하는 작은 추가는 catch-all을 사용한다. 독립 page.tsx로 라우트를 나눌 경우 그 경로는 기존 catch-all 인증을 거치지 않는다. 먼저 공통 인증·shell 구조를 분리해 같은 보호를 적용해야 한다. 파일을 새로 만들었다는 이유로 보호된다고 가정하지 않는다.

## 단일 HTML 페이지 추가

기존 단일 HTML을 React로 옮기지 않고 등록할 수 있다. [등록·격리·데이터 연결 가이드](single-html-pages.md)를 따른다. `/cash/old`가 실제 예시다. HTML은 저장소에 추가 후 배포하며, 일반 웹 HTML 업로드 관리자는 제공하지 않는다.

## 4. 새 데이터 도메인과 MCP까지 추가

예: 책 관리처럼 새 영역이면 다음 순서로 설계한다.

| 계층 | 확인·수정할 파일과 기준 |
|---|---|
| 저장 | `db/migrations/006_*.sql` 이후 새 번호. household_id, UUID, 관계/유일 제약, created_by, 필요 시 version/index. 기존 적용 파일을 수정하지 않는다 |
| 계약 | `src/lib/types.ts`의 도메인 타입과 Snapshot, `src/lib/contracts.ts`의 입력 검증과 명령 이름. 숫자 범위·nullable·단위 명시 |
| 인증 | 새 Scope/allScopes, auth.ts의 OAuth scope/resource, security.ts, auth-screens.tsx의 동의 라벨, `/api/mcp`의 challenge와 discovery 응답을 전부 검색해 반영 |
| 서비스 | service.ts의 테이블 매핑·record·execute·snapshot. 현재 execute의 scope 선택은 coffee 접두사/그 외 wine 분기이므로 새 도메인은 명시적으로 확장해야 함 |
| 읽기 | snapshot의 scope별 조회/빈 목록 규칙. 다른 공간 데이터가 합계·추천·export에 섞이지 않아야 함 |
| 웹 | catch-all 허용 경로, AppShell content/active/nav, 별도 화면 컴포넌트, workspace-home.tsx의 도구 카드 |
| MCP | server/mcp.ts의 명령 scope 선택·목록 매핑·상세 도구·URL·요약. 새 명령이 자동 wine:write로 공개되지 않도록 수정 |
| 안내 | lib/mcp-guide.ts, components/mcp-guide.tsx 그룹/도구 수, auth 동의 설명, service-design.md |
| 샘플·운영 | lib/demo.ts, demo view, scripts/export.ts, 필요 시 seed/import. 실제 DB를 fixture로 사용하지 않음 |
| 검증 | 아래 위험별 검증. 통합/E2E fixture 및 CI에 새 Snapshot 필드 영향 확인 |

새 scope를 추가하면 기존 AI 연결에 그 권한이 자동 부여되지 않는다. 새 권한 동의/재연결 흐름을 제공한다. 테넌트·사용자·작성자를 도구 인자로 신뢰하지 않는다. 모든 수정은 SQL 파라미터를 바인딩한다.

## 5. 테스트와 검토

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

통합/E2E는 로컬 `daily_test`를 초기화하며 동시에 실행하지 않는다. 통합 테스트는 DB와 사용자를 만들고 E2E도 별도 setup으로 초기화한다. 테스트 시나리오가 운영 데이터의 고정 병수에 의존하지 않게 한다. CI는 PostgreSQL 17, 배포 DB는 PostgreSQL 18이다.

- 문구/CSS: 타입·린트·빌드, 관련 화면의 모바일/PC 검증. 구현을 그대로 반복하는 테스트를 억지로 추가하지 않는다.
- 저장/권한/금액: 스키마 검증·다른 공간 접근·작성자·읽기 전용 scope·중복 키·버전 충돌 테스트.
- 재고: 동시 소비, 음수 방지, 롤백, 중복 취소, 이관 재고 보존.
- 인증: 로그인·MCP 동의·scope·갱신·해제 회귀 확인.
- CSS 변경: 390px 및 1440px에서 긴 텍스트·폼·빈 상태·가로 넘침 확인. 테스트 Chromium 결과를 실제 Safari 검증으로 표현하지 않는다.

`next-env.d.ts`는 Next가 자동 생성하며 E2E의 `.next-e2e` 경로로 바뀔 수 있다. 손으로 고치지 말고 최종 typecheck/build가 생성한 상태를 확인한다. secrets, backups, test-results는 커밋하지 않는다.

## 6. 작업 종료

변경 목적·실제 동작·영향 범위·검증 결과·남은 한계를 요약한다. docs/service-design.md의 라우트 표와 담당 도메인 문서를 갱신하고, 스키마/권한/운영 방법을 바꿨다면 아키텍처/운영 문서도 갱신한다. 새 의존성은 이유와 lockfile을 포함한다.

현재 main push는 Vercel 운영 배포를 시작한다. 브랜치는 `feature/설명`을 사용하고 작업 요청의 배포 범위를 확인한다. 배포가 요청된 작업은 [배포 절차](deployment.md)에 따라 운영 DB의 호환 migration을 먼저 적용하고 Ready를 확인한다. 정적 문서의 예시나 옛 스킬 자체는 운영 변경 권한이 아니다.

## 다른 에이전트에게 전달할 작업 예시

> AGENTS.md와 docs/README.md의 순서대로 읽고 MONO의 `/요청한경로`를 추가해주세요. 기존 인증·공유 공간·MCP 규칙을 유지하고 모바일/PC 화면을 구현하세요. 기존 수정 사항을 보존하고, 필요한 migration·서버 검증·관련 테스트와 문서를 함께 갱신하세요. 배포 범위: [로컬만 / 운영까지]. 기능과 완료 기준: [구체적 요구사항].
