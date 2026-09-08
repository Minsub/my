# Vercel 직접 만들기

## Git 저장소에서 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard)에서 사용할 개인/팀 공간을 선택한다.
2. Add New → Project → GitHub 저장소 Import. 저장소가 없으면 GitHub 연동에서 해당 저장소 접근을 허용한다.
3. 프로젝트 이름은 자유롭게 정한다. Framework Preset은 Next.js, Root Directory는 저장소 루트다. Node.js는 **22.x**로 지정한다.
4. `vercel.json` 기준으로 Install `npm ci`, Build `npm run build`, 함수 지역 `sin1`을 사용한다. Output Directory는 Next.js 기본값이다. migration/seed를 Build Command에 추가하지 않는다.
5. Deploy 후 프로젝트의 고정 운영 도메인을 기록한다. 매 배포마다 달라지는 preview URL을 BETTER_AUTH_URL로 쓰지 않는다.

[프로젝트 생성](https://vercel.com/docs/projects/managing-projects) · [프로젝트 설정](https://vercel.com/docs/project-configuration/project-settings)

## 환경변수 등록

프로젝트 Settings → Environment Variables에서 [환경변수 표](../deployment.md#환경변수)를 보며 **Production** 값을 입력한다. DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_SECRET은 민감한 값으로 보관한다. 이 앱의 환경변수에 NEXT_PUBLIC_ 접두사를 붙이지 않는다.

BETTER_AUTH_URL은 최종 HTTPS origin, LOCAL_PASSWORD_AUTH는 false다. 로컬 파일은 Vercel에 자동 업로드되지 않는다. 저장 후 Deployments에서 Redeploy하여 새 값으로 빌드한다. [환경변수](https://vercel.com/docs/environment-variables) · [변경 후 재배포](https://vercel.com/academy/vercel-foundations/vercel-settings)

Preview에는 운영 DB/secret을 복사하지 않는다. 초기에는 비워 준비 화면만 제공해도 된다. 실제 Preview 로그인을 테스트하려면 별도 DB·secret·고정 시험 origin과 그 origin의 Google callback이 필요하다.

## 도메인과 로그인

Settings → Domains에서 도메인을 확인하거나 원하는 도메인을 추가하고 안내된 DNS를 설정한다. 도메인 변경 시 BETTER_AUTH_URL, Google redirect URI, AI MCP 연결 주소를 모두 함께 갱신한다. Google Cloud의 표시 앱 이름도 별도 Branding 설정이며 코드 이름 변경으로 자동 바뀌지 않는다.

외부 AI가 운영 MCP/discovery/login에 접근할 수 있어야 한다. Vercel의 배포 보호 화면이 먼저 나오면 앱의 OAuth까지 도달하지 못한다. 조직 보안 정책을 확인해 의도된 외부 접속용 운영 도메인을 선택한다. 앱 자체 Google 로그인과 MCP OAuth를 제거해서 해결하지 않는다.

## 이후 배포

Production Branch는 현재 main이다. 연결된 저장소의 main push는 자동 운영 배포를 시작한다. 변경 내용을 검토하고 CI/관련 테스트를 확인한 뒤 push한다. 스키마 변경이 있으면 호환 migration을 먼저 명시적으로 실행한다.

Deployments에서 정확한 commit과 Production/Ready를 확인하고 운영 로그인·페이지·MCP를 점검한다. 실패하면 해당 배포의 Build Logs/Runtime Logs를 읽되 secret이나 업로드 파일 본문을 복사하지 않는다. 이전 코드로 Rollback할 수 있지만 DB migration은 자동 취소되지 않는다.
