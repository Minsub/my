# MONO 작업 안내

이 저장소는 여러 페이지와 도구를 추가해 사용하는 개인 앱 MONO다. 구성원 공유는 기능이며 앱의 정체성을 가족/커피/와인 전용 서비스로 표현하지 않는다.

## 먼저 읽기

1. `docs/README.md` — 문서 지도
2. `docs/development.md` — 페이지 추가·수정 절차와 테스트
3. `docs/architecture-design.md` — 현재 구현 경계
4. `docs/service-design.md` — 화면·데이터 의미
5. 작업 도메인의 문서. `docs/archive/`는 실행 지침이 아니다.

## 반드시 유지할 사항

- 시작 시 git status 확인. 기존 사용자 변경과 비공개 환경 파일을 보존한다.
- Node 22.x와 npm lockfile 사용. 웹·MCP는 같은 서버 업무 규칙을 사용한다.
- 모든 데이터 접근에 인증된 Actor와 공간 조건을 적용한다. household라는 내부 이름은 제품 문구와 무관하며 삭제하지 않는다.
- 와인 재고는 이벤트 합계다. 행 잠금·음수 방지·중복 키·version 검사·취소 이력을 유지한다.
- 적용된 migration을 수정하지 않는다. 새 파일을 추가하고 빌드에서 자동 migration하지 않는다.
- `.env.local`은 개발 DB. `.env.vercel.local`은 명시적으로 읽는 운영 값. TEST_DATABASE_URL은 로컬 `_test` DB만 허용하며 테스트가 데이터를 초기화한다.
- secrets·로그인 토큰·사진 원본·backups를 출력하거나 커밋하지 않는다. `.vercel/`의 임시 스크립트는 프로젝트 인터페이스가 아니다.
- main push는 운영 배포를 시작한다. 배포 권한은 사용자의 현재 요청/기존 승인 범위로 판단한다. 브랜치 기본 접두사는 `feature/`.
- 변경에 맞는 검사 후 실제 확인한 결과만 보고하고 문서를 함께 갱신한다. MCP 변경 시 도구 안내·scope·동의 UI도 확인한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
