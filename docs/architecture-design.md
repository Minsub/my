# MONO — 현재 아키텍처

2026-09-08 구현 기준. 이전 Drizzle·도메인별 폴더 제안은 현재 구조가 아니다. 페이지 확장은 [개발 가이드](development.md)를 따른다.

## 실행 구조

```mermaid
flowchart LR
  Browser[웹 브라우저] --> Page[Next.js 서버 페이지]
  Browser --> Commands[POST /api/commands]
  AI[외부 AI] --> MCP[/api/mcp · OAuth]
  Page --> Snapshot[snapshot · 읽기 서비스]
  Commands --> Execute[execute · 변경 서비스]
  MCP --> Snapshot
  MCP --> Execute
  Browser --> Photos[/api/wine/id/photo]
  MCP --> Upload[uploadWinePhoto]
  Photos --> Upload
  Snapshot --> DB[(Neon PostgreSQL)]
  Execute --> DB
  Upload --> DB
  Photos --> DB
```

- Next.js 16 App Router, React 19, TypeScript. Node.js **22.x**, Vercel `sin1`.
- PostgreSQL + `pg` 풀, 명시적 SQL 트랜잭션. ORM/Drizzle, Redis, 큐, 독립 백엔드는 없다.
- Better Auth + OAuth Provider로 웹 세션과 MCP 위임 인증을 제공한다. Neon Auth를 사용하는 구조가 아니다.
- 외부 AI가 질문·추론을 수행한다. 서버는 LLM을 호출하지 않는다. 앱 내 채팅·OCR·자동 웹 이미지 수집·실시간 동기화는 없다.

## 실제 파일 지도

| 파일/경로 | 역할 |
|---|---|
| `src/app/(family)/[[...path]]/page.tsx` | 인증된 모든 업무 페이지의 catch-all. 경로 allowlist, UUID 경로 검사, webActor, snapshot, AppShell 전달. params/searchParams는 Promise |
| `src/components/app-shell.tsx` | 공통 메뉴·경로 분기·폼·저장·새로고침. 커피·와인 상세·설정 등 기존 화면 |
| `src/components/workspace-home.tsx` | 모듈 진입 중심 홈 |
| `src/components/wine-cellar.tsx` | 와인 대시보드·검색·정렬·반응형 목록 |
| `src/components/record-form.tsx` | FormSpec 기반 입력·오류·중복 키 유지 |
| `src/lib/contracts.ts` | Zod commandSchemas, Operation, 공통 목록 입력 |
| `src/lib/types.ts` | Actor, Scope, Snapshot 및 도메인 타입 |
| `src/server/service.ts` | execute, snapshot, 소유권·버전·재고 규칙, 변경 로그 |
| `src/server/db.ts` | pg Pool(max 5), 파라미터 쿼리, transaction, DATE 문자열 파서 |
| `src/server/security.ts` | webActor/mcpActor, 활성 멤버십·scope, Origin, DB 기반 rateLimit, 오류 응답 |
| `src/server/auth.ts` | Google 로그인, OWNER_EMAIL 최초 소유자, 초대 검증, OAuth/JWT 발급·폐기 |
| `src/server/mcp.ts` | 25개 도구 등록, scope별 노출, 서비스 호출, 결과·오류 변환 |
| `src/lib/mcp-guide.ts`, `src/components/mcp-guide.tsx` | 설정에서 보여주는 도구 목록과 사용 안내 |
| `src/server/wine-photos.ts` | 사진 검증·압축·권한·버전·중복 방지·저장 |
| `src/lib/wine-cellar.ts` | 웹·MCP가 공유하는 최근 구입가/평점 계산, 필터·정렬 |
| `src/server/cash.ts`, `cash-parser.ts`, `src/lib/cash.ts` | 웹 전용 XLSX 원본 저장·검증·집계. 공통 snapshot과 분리 |
| `db/migrations/*.sql` | 적용 순서가 있는 실제 도메인 스키마 |

`(family)`는 URL에 포함되지 않는다. 별도 `(family)/layout.tsx`나 `modules/*/repository.ts`, `/api/coffee/*`는 현재 없다. 새 페이지 파일 하나를 추가하는 것만으로 기존 공통 메뉴가 자동 연결되지는 않는다.

## 인증과 접근 경계

Actor는 `{userId, householdId, role, scopes, channel, clientId?}`다. 입력에서 사용자·공간 ID를 받지 않고 검증된 인증으로 생성한다. `household_id`는 공유 공간의 내부 경계로 유지한다. MONO라는 개인용 표현으로 바꾸어도 데이터 격리는 제거하지 않는다.

웹은 Better Auth 세션, MCP는 OAuth Bearer token을 사용한다. Google access token을 MCP에 재사용하지 않는다. MCP는 DCR, Authorization Code+PKCE(S256), discovery, resource 검증, refresh를 지원한다. CIMD 전용 연결은 구현하지 않았다. access token 15분, refresh token 30일 설정이다.

scope는 `coffee:read/write`, `wine:read/write`. scope만으로 소유권을 대체하지 않는다. 관리자는 공용 항목을 수정할 수 있고 구성원은 본인이 만든 항목을 수정한다. 평가·세팅은 본인 기록이다. 본인 AI 연결을 해제하면 저장된 동의와 토큰 및 JWT 발급시각 차단으로 기존 토큰이 무효화된다. 매 요청 활성 멤버십을 확인한다.

UI 숨김은 보안 검사가 아니다. 쿠키 기반 변경은 sameOrigin, 모든 서버 입구는 인증과 권한 검사를 유지한다. RLS를 쓰고 있다고 가정하지 않는다. 현재는 애플리케이션에서 공간 조건과 관계 검사를 적용하며 일부 관계는 복합 FK가 보강한다. 운영 DB 역할은 현재 owner 역할이므로 최소권한 전용 역할은 후속 운영 개선이다.

## 변경과 조회

`POST /api/commands` → 입력 크기/Origin/인증/빈도 검사 → `execute` → Zod → scope → 트랜잭션. `mutation_requests`의 공간·사용자·UUID 키와 입력 해시/결과로 중복을 막는다. 주요 수정은 version 충돌을 409로 거부한다. `activity_log`에는 공통 명령의 작업자·경로·라벨이 남는다. 사진 업로드는 별도 요청 테이블을 사용하며 현재 공통 activity_log에는 남지 않는다.

와인 재고는 `SUM(wine_stock_events.delta)`. 와인 행을 FOR UPDATE로 잠근 뒤 별도 쿼리로 잔량을 읽고 입고/소비/취소를 원자적으로 기록한다. 재고 컬럼을 직접 덮어쓰지 않는다. 음수 재고, 중복 취소는 거부한다. 취소는 원본 삭제가 아닌 반대 이벤트다.

`snapshot`은 읽기 전용 REPEATABLE READ 트랜잭션에서 공간·허용 도메인 데이터를 반환한다. 페이지 최초 진입과 `/api/data` 새로고침이 같은 서비스를 쓴다. 저장 후 재조회하며 외부 AI 변경은 새로고침으로 확인한다. 도메인 전체를 읽는 방식이므로 대량 데이터에서는 전용 SQL 조회·페이지네이션을 추가한다. MCP 페이지 제한은 DB 조회량 제한을 의미하지 않는다.

## 사진과 영속성

와인 사진은 `wine_photos.content`의 bytea다. 원본 최대 약 2MB를 검증하고 최대 1,000px/300KB WebP로 축소, EXIF/위치정보를 제거한다. 원본은 보관하지 않는다. `wine_photo_requests`로 멱등성을 처리한다. `/api/wine/{id}/photo`는 세션 또는 wine:read 토큰을 검사하며 private/no-store로 반환한다. 목록에는 has_photo만 넣는다.

원두 image_url은 외부 HTTPS 주소다. 와인 사진과 혼동하지 않는다. Vercel Blob/S3는 현재 필요 없으며 서버리스 파일시스템에는 영구 데이터를 저장하지 않는다. `db:export`는 사진 base64도 포함하지만 인증·이관 원본까지 복원하는 도구는 아니다.

## 환경과 변경 정책

로컬 `.env.local`은 개발 DB, `.env.vercel.local`은 명시 실행용 운영 값이다. 자동화 테스트는 로컬 `_test` DB를 초기화한다. 운영/개발/테스트를 섞지 않는다. 적용한 SQL은 수정하지 않고 새 migration을 추가한다. 빌드는 DB를 변경하지 않는다. 코드 롤백과 DB 복구는 별개다. 자세한 절차는 [운영 문서](deployment.md)에 있다.

## 가계부 원본 파일

`/cash`는 전용 `/api/cash` 및 `/api/cash/files`를 사용한다. cash_files의 공간·정규화 파일명 키로 bytea 최신 1개만 저장하며 005 migration이 필요하다. 파싱 결과는 최대 8개 파일의 5분 메모리 캐시이고 거래별 영속 저장은 없다. 신규 데이터는 기존 OAuth scope나 snapshot에 추가하지 않았다. 자세한 업로드·권한·평균 규칙은 [가계부 문서](cash-money/README.md)를 따른다.

## 단일 HTML 실행

`/cash/old`는 보호된 `/api/html-pages/cash-old` 소스를 `SingleHtmlPage`가 opaque-origin sandbox iframe으로 실행한다. 서버 등록 목록의 HTML만 사용한다. 부모 앱은 인증된 파일 API에서 엑셀을 한 번씩 받아 지정 iframe에 전달하고, iframe은 앱 저장소/인증/API/외부 네트워크에 직접 접근하지 않는다. 기존 frame 보안 헤더는 유지한다. 라이브러리는 로컬 패키지를 인라인으로 공급하며 Vercel tracing에 명시한다. [추가 절차와 제한](single-html-pages.md).
