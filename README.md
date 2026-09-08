# MONO

데이터를 모으고, 도구를 만들고, AI로 조회하는 개인 워크스페이스. 커피와 와인은 첫 모듈이며 필요한 페이지를 계속 추가하는 앱입니다. 구성원 공유·권한 관리는 기능으로 제공합니다.

- 홈: 도구 바로가기와 최근 활동
- 커피: 브랜드·원두·가격·평가·추출 설정
- 와인: 재고·구매·시음·사진·필터·대시보드
- AI: OAuth MCP 연결과 25개 도구 안내
- 모바일 카드/하단 메뉴, PC 사이드바/넓은 목록

**Next.js + TypeScript + PostgreSQL(pg) + Better Auth + MCP**, Node.js **22.x**. Vercel 실행, Neon DB를 사용합니다. ORM·별도 AI 서버는 없습니다.

## 작업을 이어받는 에이전트

[AGENTS.md](AGENTS.md) → [문서 지도](docs/README.md) → [페이지 개발 가이드](docs/development.md)를 읽으세요. 초기 설계 제안 대신 실제 파일·라우트·권한·테스트 기준을 정리했습니다.

## 클라우드를 직접 설정하기

[전체 순서](docs/setup/README.md) · [Neon](docs/setup/neon.md) · [Vercel](docs/setup/vercel.md) · [Google OAuth](docs/setup/google-oauth.md) · [배포·백업·현재 환경](docs/deployment.md)

운영: https://my-seven-sandy.vercel.app · MCP: https://my-seven-sandy.vercel.app/api/mcp

## 로컬 실행

기존 `.env.local`이 있는 이 컴퓨터에서는 개발용 Neon에 연결됩니다. 파일을 덮어쓰지 않고 Node 22.x에서 실행합니다.

```sh
npm ci
npm run dev
```

환경변수가 없는 새 clone은 `/demo`로 화면을 볼 수 있습니다. 직접 저장하려면 위 Neon 가이드 또는 다음의 독립 Docker 개발 환경을 준비합니다.

### 새 Docker 개발 환경

Docker와 Node 22.x를 준비하고 **기존 .env.local이 없을 때만** 예제를 복사합니다.

```sh
npm ci
cp .env.example .env.local
docker compose up -d
openssl rand -hex 32
```

생성한 secret과 아래 개발 값을 `.env.local`에 저장합니다. Google 항목은 로컬 비밀번호 방식에서는 비워둡니다.

```dotenv
DATABASE_URL=postgresql://daily:local-development-only@127.0.0.1:54329/daily
MIGRATION_DATABASE_URL=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=직접_생성한_값
OWNER_EMAIL=owner@example.com
HOUSEHOLD_NAME=MONO
LOCAL_PASSWORD_AUTH=true
```

```sh
npm run db:migrate
npm run local:setup
npm run dev
```

http://localhost:3000 에서 OWNER_EMAIL / `Local-demo-password-2026!`로 로그인합니다. local:setup은 로컬 전용 계정과 초기 원두를 만듭니다. 비밀번호 로그인은 localhost/127.0.0.1이며 Vercel이 아닌 경우에만 가능합니다. 운영은 Google로 로그인합니다.

## 테스트

시험 DB가 없을 때 한 번 생성합니다. 기존 Docker 컨테이너를 직접 만든 환경이면 `docker exec daily-cellar-local createdb -U daily daily_test`를 사용합니다.

```sh
docker compose exec postgres createdb -U daily daily_test
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

테스트는 localhost의 `_test` DB만 허용하며 데이터를 초기화합니다. Vitest와 E2E는 같은 시험 DB를 쓰므로 **순서대로** 실행합니다. E2E는 포트 3100, 별도 `.next-e2e` 출력을 사용합니다. 상세 기준은 [개발 가이드](docs/development.md), 실제 확인 범위는 [검증 기록](docs/verification.md)에 있습니다.

## 참고

`npm run db:export`는 도메인 데이터와 압축 사진을 내보냅니다. 전체 DB 복원과 Airtable 이관은 [운영 문서](docs/deployment.md)를 따릅니다. 원두 seed는 현재 데이터가 아닌 원본 요구사항의 초기 목록입니다. 서버리스 파일시스템에 데이터를 영구 저장하지 않습니다.

이름 변경은 표시 브랜드 기준입니다. 저장소 `my`, npm 패키지/MCP 서버 ID `daily-cellar`, 기존 URL과 `household_*` 테이블은 호환성을 위해 유지합니다. Google 콘솔의 OAuth 표시 이름도 별도 설정입니다.
