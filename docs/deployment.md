# Vercel 배포와 운영

## 1. 배포 대상

저장소 루트를 Vercel에 Next.js 프로젝트로 등록합니다. Node.js는 **22.x**로 지정합니다. `vercel.json`의 설치 명령은 `npm ci`, 빌드는 `npm run build`, 함수 지역은 기존 Neon 운영 DB와 같은 싱가포르 `sin1`입니다. 장시간 연결 상태를 서버 메모리에 보관하지 않는 MCP이며 Redis는 사용하지 않습니다.

환경변수 없이 배포하면 준비 화면과 읽기 전용 `/demo`가 동작합니다. DB 초기화는 빌드에 포함하지 않아 Preview 배포가 운영 스키마를 자동 변경하지 않습니다.

## 2. 운영 환경변수

Vercel → 프로젝트 → Settings → Environment Variables에서 **Production**에 설정합니다.

| 변수                   | 값                                                                              |
| ---------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Neon의 pooled PostgreSQL URL. TLS 연결 옵션을 포함                              |
| `BETTER_AUTH_URL`      | 최종 HTTPS origin. 예: `https://collection.example.com`. 경로와 마지막 `/` 제외 |
| `BETTER_AUTH_SECRET`   | `openssl rand -hex 32`로 생성한 값. 계속 유지할 것                              |
| `GOOGLE_CLIENT_ID`     | Google Web application OAuth Client ID                                          |
| `GOOGLE_CLIENT_SECRET` | 해당 OAuth Client Secret                                                        |
| `OWNER_EMAIL`          | 최초 가족 관리자가 로그인할 Google 이메일                                       |
| `HOUSEHOLD_NAME`       | 가족 공간 이름. 생략하면 `우리 집`                                              |
| `LOCAL_PASSWORD_AUTH`  | `false` 또는 생략                                                               |

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`은 sensitive로 지정합니다. 클라이언트 공개용 `NEXT_PUBLIC_` 변수로 만들지 않습니다. Preview에는 별도 시험 DB·secret·고정 시험 도메인을 사용하거나 환경변수를 비워 준비 화면만 제공합니다. 변경 후 재배포해야 적용됩니다. [Vercel 환경변수](https://vercel.com/docs/environment-variables), [민감한 환경변수](https://vercel.com/docs/environment-variables/sensitive-environment-variables)

Vercel Deployment Protection을 사용하는 경우 외부 AI가 MCP 및 OAuth discovery에 접근 가능한 운영 도메인을 사용해야 합니다. 앱 자체의 로그인과 OAuth는 계속 적용됩니다.

## 3. Google 로그인 연결

Google Cloud 프로젝트에서 OAuth 동의 화면과 **Web application** 클라이언트를 준비합니다. 가족들이 사용할 계정이 허용되는 설정인지 확인합니다. OAuth 앱이 Testing 상태이면 가족을 테스트 사용자로 추가해야 할 수 있습니다.

- Authorized JavaScript origin: `https://최종도메인`
- Authorized redirect URI: **`https://최종도메인/api/auth/callback/google`**

커스텀 도메인을 정했다면 OAuth 연결 전에 최종 도메인을 확정하는 편이 좋습니다. 도메인이 바뀌면 Google callback, `BETTER_AUTH_URL`, 각 AI의 MCP 주소를 함께 변경합니다. [Better Auth Google 설정](https://www.better-auth.com/docs/authentication/google)

초대는 이메일 발송 기능이 아니라 허용 이메일 등록입니다. 관리자가 설정에서 이메일을 추가하고 가족에게 앱 URL을 알려주면 해당 Google 계정으로 로그인할 수 있습니다. 등록되지 않은 사람은 가입할 수 없습니다. 평가와 세팅은 작성자별로 저장되며 가족에게 공유됩니다.

## 4. 최초 실행 순서

1. Neon 프로젝트와 운영 DB를 생성합니다.
2. 로컬의 안전한 `.env.local` 또는 셸 환경에 위 운영 값을 설정합니다. 로컬 테스트 값을 덮어쓸 때는 별도로 보관합니다. `MIGRATION_DATABASE_URL`에는 필요하면 DDL 권한이 있는 direct URL을 설정합니다. 생략하면 `DATABASE_URL`로 초기화합니다.
3. `npm ci` 후 **`npm run db:migrate`**를 한 번 실행합니다. Better Auth 스키마와 `db/migrations/`를 순서대로 적용합니다. 이후 변경도 운영 백업 후 이 명령으로 적용합니다.
4. Vercel에 환경변수를 설정하고 배포/재배포합니다.
5. `OWNER_EMAIL`의 Google 계정으로 처음 로그인합니다. 가족 공간과 관리자 권한이 생성됩니다.
6. 같은 운영 DB를 지정한 터미널에서 **`npm run db:seed`**를 실행하면 문서의 브랜드 10개·원두 11개와 기존 취향·세팅이 초기 관리자에게 들어갑니다. 설정에서 초기 머신 이름을 확인합니다. 기존 URL의 원두나 메모는 덮어쓰지 않습니다.
7. 설정에서 가족 이메일을 등록하고 각자의 휴대폰으로 로그인합니다.
8. MCP 주소를 연결하고 조회·등록·연결 해제를 확인합니다.

마이그레이션 파일은 적용 후 수정하지 않습니다. 새로운 SQL 파일을 추가합니다. 마이그레이션 명령은 한 번에 한 운영자가 실행합니다. 운영 DB 연결정보를 로컬 테스트에 사용하지 않습니다.

## 5. AI 연결

연결 주소는 **`https://최종도메인/api/mcp`**이며 설정 페이지에서 복사할 수 있습니다. 외부 AI는 원격 HTTP MCP와 OAuth를 지원해야 합니다. 사용자별 기능/플랜/관리자 정책에 따라 연결 가능 여부가 달라집니다.

구현한 연결 방식:

- Streamable HTTP, MCP `2025-11-25` 및 `2026-07-28` 요청 검증
- OAuth authorization server / protected resource discovery
- Dynamic Client Registration(DCR), Authorization Code + PKCE(S256), refresh token
- 15분 access token, 30일 refresh token, 발급 서버·resource·현재 가족 멤버십 검증
- `coffee:read`, `coffee:write`, `wine:read`, `wine:write` scope
- 요청한 권한을 표시하는 동의 페이지와 본인 AI 연결 해제

기본 연결 challenge는 조회·쓰기 네 권한을 안내합니다. 도메인별 최소 scope를 지정하는 클라이언트는 읽기만 연결할 수 있고, 허용한 scope의 도구만 노출됩니다. 추가 권한이 필요하면 클라이언트에서 해당 scope로 다시 연결합니다. CIMD만 지원하는 클라이언트는 아직 대상이 아니며 DCR 지원 또는 별도 호환 작업이 필요합니다.

변경 도구는 UUID `idempotency_key`가 필수입니다. 같은 작업의 통신 재시도에는 같은 키와 같은 입력을 사용합니다. 사용자가 새 작업을 요청했을 때만 새 키를 만듭니다. `wine_create`는 와인 정보만 만들고, `wine_receive_stock`이 구매 내역과 재고를 함께 저장합니다. 가족 초대·해제는 MCP에 공개하지 않습니다.

연결 해제는 동의·refresh/access 저장 레코드를 삭제하고 JWT 발급 시각 기준 차단도 저장합니다. 이미 발급된 토큰을 즉시 차단하며 재연결해도 옛 토큰이 살아나지 않습니다. 같은 초에 즉시 재연결하면 이전 토큰과 구분하기 위해 거부될 수 있으므로 다음 초에 다시 연결합니다. 서명키만 검사하는 JWT 검증으로 바꾸면 이 보장이 사라집니다.

구현 당시 OAuth 흐름과 두 MCP 프로토콜을 로컬에서 검증했습니다. Google 공급자 로그인과 Neon DB 연결은 확인했습니다. Claude·ChatGPT·Codex 각각의 서비스 계정 연결은 아직 검증하지 않았습니다. 배포 후 각 클라이언트에서 연결 → 목록 조회 → 원두 등록 또는 와인 입고/소비 → 설정에서 해제 → 기존 토큰 접근 거부를 확인합니다.

## 6. 백업과 이관

`npm run db:export`는 현재 가족의 도메인 데이터만 JSON으로 내보냅니다. 로그인·토큰·키·이관 원본까지 되살리는 전체 복원 도구가 아닙니다. Neon의 백업/복구 설정과 복구 가능한 보존 기간을 확인하고 별도 PostgreSQL 백업을 유지합니다. [Neon 복구](https://neon.com/docs/introduction/branch-restore)

전체 백업 예시는 아래와 같습니다. `PGSERVICE`는 운영자의 `.pg_service.conf`에 만든 연결 이름입니다. 비밀번호를 명령줄 인자에 직접 넣지 않습니다.

```sh
umask 077
PGSERVICE=daily_backup pg_dump --format=custom --file=backups/full.dump
```

복구는 먼저 별도 시험 DB에서 `pg_restore`로 검증하고 원두 수·와인별 잔량·가족 로그인·OAuth 연결을 대조합니다. 운영 DB에 바로 복구 명령을 실행하지 않습니다. DB와 `BETTER_AUTH_SECRET`을 함께 안전하게 보관합니다. secret을 바꾸면 기존에 암호화된 키와 로그인 정보에 영향을 줄 수 있습니다.

Airtable 이관은 JSON만 지원하고 `--apply` 없이 사전 검증합니다. 기존 수량은 이관일의 초기 재고 이벤트 한 건으로 옮깁니다. 구매가·구매일·기존 표시 번호는 `import_records.raw`에 보존하며 새 구매로 계산하지 않습니다. 누적 시음은 원문 하나와 날짜 미상으로 보존합니다. 이관 후 기록을 수정했더라도 같은 원본 ID를 재실행하면 덮어쓰지 않습니다.

## 7. 설계와 구현의 차이·후속 범위

- Drizzle을 기본안으로 검토했지만 현재 규모에서는 `pg`의 파라미터화 SQL과 버전 SQL 마이그레이션으로 구현했습니다. 웹과 MCP는 동일한 서비스·권한 검사·트랜잭션을 사용합니다.
- UI는 모바일 전용 하단 이동·카드형 와인 목록과 PC 사이드바·테이블을 각각 제공합니다. iPhone 크기의 Chromium 및 PC Chromium을 자동 검증합니다. 실제 iOS Safari 기기 검증은 별도입니다.
- 현재 재고량과 월별 소비량을 차트로 제공합니다. 세부 기간 선택, 지출 추이, 가족 점수 비교 차트는 후속 범위입니다.
- 사진은 HTTPS 이미지 URL 표시까지만 지원합니다. 업로드/OCR, 라벨 자동 인식, 웹 내장 AI 채팅은 포함하지 않습니다.
- 와인 이관은 실제 Airtable 데이터 제공 전이므로 샘플 파싱만 검증했습니다. 운영 원본 대조는 이관할 때 필요합니다.
- 가족 규모를 기준으로 목록 snapshot을 조회합니다. MCP 출력에는 페이지 제한이 있지만 DB 조회 자체는 도메인 전체입니다. 데이터가 커지면 SQL 페이지네이션/전용 집계로 분리합니다.
- 가족 접근 해제는 즉시 적용됩니다. 해제한 기존 계정의 재활성화와 관리자 권한 이전은 현재 운영자가 DB에서 처리해야 합니다.
- 사진 업로드·예약 작업·자체 LLM 호출·메일 발송을 실행하는 별도 외부 서비스는 없습니다.

함수 최대 실행 시간은 MCP route의 `maxDuration = 30`으로 지정합니다. 서버리스 파일시스템에 영구 데이터를 저장하지 않습니다. [Vercel 실행 시간 설정](https://vercel.com/docs/functions/configuring-functions/duration)


## 8. 현재 연결된 클라우드 환경 (2026-09-08)

- 운영 앱: https://my-seven-sandy.vercel.app
- MCP: https://my-seven-sandy.vercel.app/api/mcp
- Vercel: `minsub / my`, GitHub `Minsub/my`의 `main` 자동 배포
- Neon: `my` (`little-river-19493732`), AWS Singapore, PostgreSQL 18
- 운영 브랜치: `production` (`br-cool-voice-b33bvl54`)
- 로컬 개발 브랜치: `development` (`br-round-frost-b339169t`), 초기 운영 데이터 복제
- Google Cloud: `daily-cellar` (`arctic-marking-508007-h8`), Web OAuth 클라이언트

`.env.local`에는 **Neon development**와 localhost Google 로그인 설정을 저장했습니다. `npm run dev`로 실행합니다. 이 브랜치는 생성 시점의 데이터 사본이며 운영 변경을 실시간으로 동기화하지 않습니다. 기존 Docker 설정은 무시되는 `.env.docker.local`에 보관했습니다. Vitest와 Playwright는 별도의 localhost `daily_test` DB를 계속 사용합니다.

운영 비밀 값은 Git에서 제외된 `.env.vercel.local`과 Vercel Production에 저장합니다. Next.js가 자동으로 불러오는 파일명이 아니므로 로컬 실행이 운영 DB로 바뀌지 않습니다. 운영 마이그레이션·초기 데이터 명령은 이 파일을 명시적으로 읽은 환경에서 실행해야 합니다. 비밀 값을 소스 코드나 공개 문서에 복사하지 않습니다.

Google OAuth 콜백은 운영 `/api/auth/callback/google`과 `http://localhost:3000/api/auth/callback/google`을 허용합니다. 관리자 첫 Google 로그인 및 운영 원두 11개 초기 등록을 완료했습니다. 와인 셀러는 Airtable에서 64종·62병, 와인잔 5종을 운영 및 개발 DB에 이관했습니다. 세부 보존 방식은 `docs/wine-celler/migration-report.md`를 참고하세요.


Google OAuth는 **Production**으로 전환했습니다. Google Cloud에 가족을 테스트 사용자로 따로 등록할 필요 없이 앱의 가족 초대로 접근을 제어합니다. 개인정보 안내는 `/privacy`에 공개됩니다. 로컬 development의 서명 secret은 운영과 분리했으며, DB 브랜치를 운영에서 다시 복제할 때는 인증 데이터와 secret의 호환성을 함께 점검합니다.
