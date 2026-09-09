# MONO 배포와 운영

처음 만드는 경우 [클라우드 설정 순서](setup/README.md)를 따른다. 이 문서는 기존 환경을 운영하는 기준이다.

## 현재 운영 환경

2026-09-08 확인. **MONO는 표시 이름**이며 아래 인프라 이름/주소는 유지한다.

| 대상 | 현재 값 |
|---|---|
| 운영 앱 | https://my-seven-sandy.vercel.app |
| MCP | https://my-seven-sandy.vercel.app/api/mcp |
| Vercel | minsub / my, GitHub Minsub/my, main 자동 배포, Node 22.x, sin1 |
| Neon | my / little-river-19493732, PostgreSQL 18, AWS Singapore |
| 운영 branch | production / br-cool-voice-b33bvl54 |
| 개발 branch | development / br-round-frost-b339169t |
| Google Cloud | daily-cellar / arctic-marking-508007-h8, Web OAuth, Production 상태 |

현재 Google Client는 운영과 localhost 콜백을 허용한다. Google 콘솔의 Branding 표시 이름은 외부 설정이며 MONO 코드 배포와 별개다. 실제 비밀번호·Client Secret·DB URL은 이 문서에 없다.

## 환경변수

| 변수 | 용도 |
|---|---|
| DATABASE_URL | 해당 환경의 Neon pooled PostgreSQL URL, TLS 옵션 유지 |
| MIGRATION_DATABASE_URL | 선택. DDL 작업용 URL. 비어 있으면 DATABASE_URL 사용 |
| BETTER_AUTH_URL | HTTPS 운영 origin 또는 http://localhost:3000. 끝 경로 없음 |
| BETTER_AUTH_SECRET | openssl rand -hex 32로 생성. 환경별 분리, 기존 운영 값 유지 |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Google Web OAuth 값 |
| OWNER_EMAIL | 최초 관리자 Google 이메일 |
| HOUSEHOLD_NAME | 내부 공유 공간 이름. 표시 브랜드와 다름. 기존 값 유지 가능 |
| LOCAL_PASSWORD_AUTH | 운영 false. localhost의 별도 개발/시험용만 true |

| 위치 | 의미 |
|---|---|
| `.env.local` | 현재 Neon development + localhost 설정. npm run dev가 자동 사용 |
| `.env.vercel.local` | 운영 명령용 비공개 파일. Next가 자동으로 로드하지 않음 |
| `.env.docker.local` | 이 컴퓨터에 보관된 Docker 개발용 설정. 다른 clone에 없을 수 있음 |
| Vercel Production | 운영 런타임 값. 로컬 파일과 자동 동기화되지 않음 |
| TEST_DATABASE_URL | 테스트 전용 localhost의 이름이 `_test`로 끝나는 DB |

`.env.production.local`에 운영 DB를 넣어 일반 build/dev 명령과 섞지 않는다. 파일은 gitignore 대상이며 권한 600으로 보관한다. 쉘에 export한 변수는 파일보다 우선할 수 있다. 환경을 바꿔 실행할 때 새 터미널에서 기존 DATABASE_URL/MIGRATION_DATABASE_URL/BETTER_AUTH_* 등의 export가 없는지 확인한다.

## 명시적 운영 명령

Node 22.x, 저장소 루트에서 실행한다. `node --env-file`이 값을 먼저 넣고 각 스크립트의 dotenv(.env.local)는 이미 설정된 값을 덮어쓰지 않는다. 운영 파일에는 필요한 값 전체를 채워 개발 값이 섞이지 않게 한다.

대상 확인(비밀번호는 출력하지 않음):

```sh
node --env-file=.env.vercel.local -e 'const u=new URL(process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL); console.log({host:u.hostname,database:u.pathname,origin:process.env.BETTER_AUTH_URL})'
```

운영 host가 맞는지 Neon Connect 화면과 대조한 뒤 실행한다. 원격 URL이라는 이유만으로 운영이라고 판정하지 않는다.

```sh
node --env-file=.env.vercel.local node_modules/tsx/dist/cli.mjs scripts/migrate.ts
# 아래는 소유자 첫 로그인 이후, 샘플이 필요할 때만
node --env-file=.env.vercel.local node_modules/tsx/dist/cli.mjs scripts/seed.ts
# 현재 공간 도메인 데이터+압축 사진 백업
node --env-file=.env.vercel.local node_modules/tsx/dist/cli.mjs scripts/export.ts
```

개발 환경은 `npm run db:migrate`, `npm run dev`로 실행한다. migration은 Better Auth 스키마와 SQL 파일을 적용하고 checksum을 기록한다. 적용 파일은 수정하지 않는다. 현재 001~004가 적용돼 있으며 새 작업은 그다음 번호부터 추가한다.

## 배포 절차

1. 변경 범위 확인, lint/typecheck 및 관련 테스트/빌드.
2. 스키마 변경이면 개발에서 검증 후 운영 백업. 기존 코드도 동작하는 additive migration을 운영에 적용한다.
3. 승인된 배포 범위에서 main push 또는 Vercel 배포. CI와 Vercel 배포는 별개라 CI 실패가 자동으로 배포를 막는다고 가정하지 않는다.
4. Vercel에서 commit·Production·Ready 확인.
5. 운영 로그인, 변경 페이지, 비로그인 API 차단, 영향받은 MCP 도구 확인. 네트워크 때문에 확인 못한 범위는 그대로 기록한다.

환경변수 변경은 재배포해야 적용된다. 도메인 변경은 Google callback·BETTER_AUTH_URL·MCP 연결 주소를 함께 바꾼다. 앱 이름 변경만으로 DB/도메인/OAuth secret을 바꾸지 않는다.

## 백업과 복구

`db:export`는 현재 소유자의 공간 Snapshot과 photos 배열을 JSON으로 저장한다. 인증·OAuth 키·이관 원본 전체·가계부 XLSX 및 자동 restore 명령은 포함하지 않는다. 가계부는 웹의 원본 다운로드나 PostgreSQL 백업으로 보관한다. 사진까지 포함하는 전체 복구는 PostgreSQL 백업을 사용한다.

PGSERVICE는 운영자가 로컬 `.pg_service.conf`에 만든 이름이다. direct host, database, user, sslmode를 지정하고 비밀번호는 권한 600의 `.pgpass`나 비밀 관리 도구로 제공한다. 다음의 mono_backup/mono_restore_test는 미리 구성한 service 이름 예시다. PostgreSQL 18 서버 백업에는 pg_dump 18 이상을 사용한다.

```sh
umask 077
mkdir -p backups
PGSERVICE=mono_backup pg_dump --format=custom --file=backups/full.dump
# 별도 빈 복구 시험 DB에만 실행. 운영 대상에 실행하지 않음
PGSERVICE=mono_restore_test pg_restore --no-owner --no-acl --dbname='service=mono_restore_test' backups/full.dump
```

복구 후 migration 이력·원두/와인 수·각 재고·사진·로그인·OAuth를 확인한다. BETTER_AUTH_SECRET도 별도 안전한 저장소에 함께 보관한다. 기존 암호화 키에 필요한 secret을 임의로 교체하지 않는다. 코드 rollback은 DB를 되돌리지 않는다. 현재 자동 일일 외부 백업/정기 복구 훈련이 구성돼 있다고 가정하지 않는다. Neon 플랜의 복구 기간은 콘솔에서 확인한다. [Neon 복구](https://neon.com/docs/introduction/branch-restore)

## 데이터 이관

Airtable JSON `{records:[{id,fields}]}`만 지원한다. `npm run db:import -- /절대경로/wines.json --kind=wines`로 먼저 검증하고 `--apply`로 반영한다. 운영은 위 명시 환경 파일 방식으로 scripts/import.ts를 실행한다. 동일 source record ID는 건너뛰며 덮어쓰지 않는다.

초기 수량은 opening_balance, 과거 가격/구입일은 원본과 reference 필드로 보존한다. 가상의 구매 수량을 만들지 않는다. 원본 JSON/백업은 gitignore의 backups에 두며 [이관 보고서](wine-celler/migration-report.md)를 참고한다. 기존 64종을 테스트 fixture로 재등록하거나 seed처럼 다시 채우지 않는다.

## 장애 확인

| 증상 | 먼저 확인 |
|---|---|
| setup 화면 | DATABASE_URL/BETTER_AUTH_URL/SECRET/OWNER_EMAIL 키 존재 및 재배포 |
| Google 로그인 실패 | Google callback, Testing 사용자, OWNER_EMAIL/앱 초대 |
| DB relation 오류 | 환경/branch/database와 app_migrations 적용 상태 |
| 수정 409 | version 충돌 또는 같은 키의 다른 입력. 재조회 후 구분 |
| MCP 401 | resource/issuer/만료/동의 폐기/현재 활성 멤버십 |
| 도구 일부 없음 | 연결 scope. 새로운 권한은 다시 동의해야 함 |
| 사진 실패 | JPEG/PNG/WebP, 크기, 권한/version. 서버는 URL 사진 수집을 하지 않음 |
| 변경이 안 보임 | 다른 DB 환경, 새로고침, 정확한 commit 배포 여부 |

구성원 재활성화/관리자 이전 UI, 앱 내 LLM, 예약 작업, 메일 발송은 현재 없다. 인증 테이블을 수동 수정해 우회하기보다 목적에 맞는 운영 절차를 별도로 설계한다.

## 가계부 최초 등록·교체

005_cash_files.sql 적용 후 웹 `/cash`의 파일 관리에서 등록한다. 운영자 최초 적재는 Node 22에서 `node --env-file=.env.vercel.local node_modules/tsx/dist/cli.mjs scripts/cash-upload.ts docs/cash-money/*.xlsx`로 실행한다. 기본 `.env.local`은 개발 DB이므로 운영은 명시한다. 같은 파일명은 최신으로 교체되며 앱 내 이전 버전 복원은 없다. 자료 원본은 Git에 올리지 않는다.
