# 취향의 기록

커피 원두와 와인 셀러를 가족과 함께 기록하는 웹 앱입니다. PC에서는 사이드바·넓은 목록, 모바일에서는 하단 내비게이션·카드·터치 입력을 제공합니다.

- 원두·브랜드 등록/수정, 1kg 환산 가격, 가족별 경험·평가, 머신 세팅
- 와인·잔 등록/수정, 구매일·단가별 입고, 소비와 시음, 재고 취소 이력
- 종류별·나라별 재고와 최근 6개월 소비량 시각화
- Google 로그인, 가족 이메일 초대, 개인별 작성자·관리자 권한
- OAuth로 연결하는 HTTP MCP API, AI별 연결 해제
- 기존 문서의 원두 11개 초기 데이터, Airtable JSON 이관·데이터 내보내기

기술 구성: **Next.js App Router + TypeScript + PostgreSQL + Better Auth + MCP**, Vercel의 Node.js 함수에서 실행합니다. DB는 Neon을 기준으로 안내하며 표준 PostgreSQL에도 연결됩니다. 재고 처리는 `pg`의 명시적인 SQL 트랜잭션으로 구현했습니다.

## Vercel에 등록하기

[배포 안내](docs/deployment.md)에 환경변수, Google callback URL, DB 초기화, 가족 초대, MCP 연결 순서를 정리했습니다. 저장소 루트를 Next.js 프로젝트로 등록하면 됩니다. 빌드 중 DB를 변경하지 않습니다.

환경변수를 아직 설정하지 않아도 `/demo`에서 화면을 둘러볼 수 있습니다. 이 페이지는 문서의 공개 초기 원두만 표시하며 가족 DB를 읽거나 변경하지 않습니다. 운영하려면 DB와 Google OAuth 설정이 필요합니다.

## 로컬 실행

Node.js 22.13 이상 또는 24 LTS, Docker가 필요합니다.

```sh
npm ci
cp .env.example .env.local
docker compose up -d
```

`.env.local`에 다음 값을 설정합니다. 나머지 Google 항목은 로컬 비밀번호 테스트에서는 비워둘 수 있습니다.

```dotenv
DATABASE_URL=postgresql://daily:local-development-only@127.0.0.1:54329/daily
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=아래_명령으로_생성한_값
OWNER_EMAIL=owner@example.com
HOUSEHOLD_NAME=우리 집
LOCAL_PASSWORD_AUTH=true
```

```sh
openssl rand -hex 32
npm run db:migrate
npm run local:setup
npm run dev
```

`http://localhost:3000`에서 로그인합니다. 로컬 준비 스크립트의 계정은 `OWNER_EMAIL`, 비밀번호는 `Local-demo-password-2026!`입니다. 비밀번호 로그인과 준비 스크립트는 **localhost/127.0.0.1이며 Vercel이 아닌 경우에만** 동작합니다. 운영에서는 Google로 로그인합니다.

Docker Compose가 없다면 다음으로 같은 DB를 실행할 수 있습니다. 두 방법 중 하나만 사용합니다.

```sh
docker run -d --name daily-cellar-local -p 127.0.0.1:54329:5432 \
  -e POSTGRES_USER=daily -e POSTGRES_PASSWORD=local-development-only \
  -e POSTGRES_DB=daily -v daily_cellar_data:/var/lib/postgresql/data postgres:17-alpine
```

## 테스트

테스트는 `localhost` 또는 `127.0.0.1`의 이름이 `_test`로 끝나는 DB만 허용하고 데이터를 초기화합니다. 운영 DB를 연결하지 마세요. 통합 테스트와 E2E는 같은 시험 DB를 사용하므로 순서대로 실행합니다.

```sh
# Compose를 사용한 경우
docker compose exec postgres createdb -U daily daily_test
# docker run을 사용했다면 대신 다음 명령
# docker exec daily-cellar-local createdb -U daily daily_test

npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

기본 시험 DB 주소는 로컬 예제의 DB 이름을 `daily_test`로 바꾼 값입니다. `TEST_DATABASE_URL`로 변경할 수 있습니다. E2E는 별도 포트 3100을 사용하고 PC 및 iPhone 크기의 Chromium에서 실행합니다.

검증 범위: 가족 데이터 분리, 권한·scope, 동시 재고 소비, 중복 재시도, 트랜잭션 롤백, 이력 보존, OAuth 등록·PKCE·동의·갱신·MCP·해제, 브라우저 등록·평가·입고·소비·취소 및 화면 가로 넘침. CI에서도 같은 검증을 실행합니다.

## 데이터 관리

```sh
npm run db:seed
npm run db:import -- /absolute/path/wines.json --kind=wines
npm run db:import -- /absolute/path/wines.json --kind=wines --apply
npm run db:import -- /absolute/path/glasses.json --kind=glasses --apply
npm run db:export
```

이관 입력은 `{ "records": [{ "id": "rec...", "fields": { "한글 이름": "...", "종류": "레드", "수량": 2 } }] }` 형태의 Airtable JSON입니다. `--apply`가 없으면 검증만 하고 같은 원본 record ID는 중복 이관하지 않습니다. CSV 및 기존 구매 내역 자동 복원은 지원하지 않습니다. 누락된 과거 시음일은 `날짜 미상`, 과거 구매가·날짜·기존 표시 번호는 원본 메타데이터로 보존합니다. 앱의 표시 번호는 새로 부여합니다.

`db:export`는 인증정보를 제외한 도메인 JSON을 `backups/`에 저장합니다. **전체 DB 복구용 백업은 별도 PostgreSQL 백업이 필요합니다.** 상세 운영 절차는 배포 안내를 확인하세요.

## 코드와 설계

```text
src/app/          페이지, HTTP API, OAuth discovery
src/components/   PC·모바일 화면과 입력 폼
src/lib/          데이터 계약, 타입, 표시 형식, 초기 목록
src/server/       인증·권한·MCP·공통 서비스·DB 트랜잭션
db/migrations/   버전별 SQL 변경
scripts/          DB 준비·초기 데이터·이관·내보내기
tests/           통합 테스트와 Playwright E2E
```

[아키텍처 검토](docs/architecture-design.md) · [서비스 설계](docs/service-design.md) · [배포 안내와 구현 범위](docs/deployment.md) · [검증 기록](docs/verification.md)

현재 앱 안의 AI 채팅, 사진 업로드/OCR, 자동 상품 정보 수집, 실시간 동기화는 포함하지 않습니다. AI와의 대화는 연결한 외부 AI에서 진행하며 변경 내용은 새로고침으로 확인합니다. 실제 Google 로그인 및 Claude·ChatGPT·Codex 계정 연결은 운영 자격증명과 배포 주소로 최종 확인해야 합니다.
