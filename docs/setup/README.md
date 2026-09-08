# MONO를 처음부터 직접 배포하기

기존 서비스를 쓰려면 새 프로젝트를 만들 필요가 없다. [현재 운영 환경](../deployment.md)을 먼저 확인한다. 아래는 새 계정/새 환경에 같은 코드를 배포하는 절차다. 버튼 명칭은 서비스 UI 업데이트로 달라질 수 있다. 2026-09-08 공식 문서와 현재 코드 기준이다.

## 준비물

- 저장소를 읽을 수 있는 GitHub 계정, Vercel·Neon·Google Cloud 계정.
- Node.js 22.x, Git, npm. 로컬 테스트용 Docker는 클라우드 배포 자체의 필수는 아니다.
- 처음 로그인할 Google 이메일. 이것이 OWNER_EMAIL이다.
- 공개 HTTPS 운영 origin. 예: `https://프로젝트.vercel.app`. 예시 문자열은 실제 값으로 바꾼다.

## 진행 순서

1. 저장소 clone → `npm ci`.
2. [Neon 프로젝트](neon.md)를 만들고 운영 pooled URL 확보.
3. [Vercel 프로젝트](vercel.md)를 Git에서 import. 환경변수 없이 먼저 배포해 고정 운영 도메인을 확보해도 된다. 이때 `/setup` 또는 `/demo`만 사용 가능하다.
4. [Google OAuth](google-oauth.md)를 만들고 위 도메인의 callback 등록.
5. `.env.example`을 참고해 비공개 `.env.vercel.local` 작성. Vercel Production에도 같은 운영 값을 저장.
6. [운영 명령](../deployment.md)의 연결 대상 확인 → db:migrate 실행 → Vercel 재배포.
7. OWNER_EMAIL의 Google 계정으로 최초 로그인. 그 뒤 필요하면 db:seed로 원두 샘플 추가. 빈 도구 공간으로 사용할 때는 seed 생략.
8. 설정에서 구성원 이메일을 허용하고 MCP를 연결해 읽기/쓰기/해제를 확인.
9. 개발용 빈 DB와 별도 secret을 준비해 `.env.local` 설정. 운영 파일을 일반 개발 설정으로 복사하지 않는다.

## 완료 기준

- Vercel 배포 Ready, 운영 `/login`이 열림.
- 최초 소유자 로그인 후 `/`에 MONO, 내 도구와 설정이 보임.
- 로그아웃 상태의 `/api/data`, `/api/mcp`는 401. 로그인한 API는 실제 DB를 읽음.
- `/.well-known/oauth-protected-resource`와 `/.well-known/oauth-authorization-server/api/auth`가 운영 origin을 가리킴.
- AI 연결 후 목록 조회, 테스트용 기록 저장/정정, 연결 해제 확인. 제품별 호환성은 각각 시험.
- 사진 업로드 후 상세 이미지가 표시되고 비로그인에서는 사진 API가 거부됨.

Vercel/Neon 프로젝트 생성만으로 기존 데이터가 옮겨지지 않는다. 기존 서비스 복제는 인증·사진·이관 원본·secret을 포함하는 별도 백업/복구 작업이다. `db:import`는 Airtable JSON 이관용이며 `db:export` 결과를 복원하는 명령이 아니다.
