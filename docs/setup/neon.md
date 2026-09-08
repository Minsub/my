# Neon 직접 만들기

## 운영 DB 생성

1. [Neon Console](https://console.neon.tech/)에 로그인한다. 사용할 조직을 선택하고 New Project/Create Project를 연다.
2. 프로젝트 이름은 원하는 이름(예: mono)을 사용한다. PostgreSQL **18**, AWS **Singapore**를 현재 코드 배포 기준으로 선택한다. 지역이 없으면 사용 가능한 가까운 지역을 선택하고 Vercel 함수 지역도 맞춘다. 플랜/지역 선택에 따른 비용은 콘솔에서 확인한다.
3. 생성된 기본 브랜치가 운영용임을 표시한다(예: production). 프로젝트·브랜치·database·role 이름을 기록한다. 기본 database `neondb`, role 이름은 실제 생성된 것을 사용한다.
4. Dashboard의 Connect를 열고 **브랜치 → database → role**을 확인한다. Connection pooling을 켠 PostgreSQL 문자열을 복사해 비공개 환경 파일의 DATABASE_URL로 사용한다. 보통 호스트에 `-pooler`가 들어간다. `sslmode=require` 등 제공된 TLS 옵션을 유지한다.
5. 마이그레이션에 별도 연결이 필요하면 pooling을 끈 direct URL을 MIGRATION_DATABASE_URL로 둔다. 비워두면 DATABASE_URL로 실행한다. 현재 앱은 pg Pool과 SQL 트랜잭션을 사용하므로 HTTP SQL 드라이버로 임의 교체하지 않는다.

[프로젝트 관리](https://neon.com/docs/manage/projects) · [연결 풀링](https://neon.com/docs/connect/connection-pooling)

연결 URL에는 DB 비밀번호가 포함된다. 문서/채팅/Git에 붙이지 말고 환경 파일은 `chmod 600`으로 보관한다. SQL Editor에서 역할·DB를 확인하고 `SELECT current_database(), current_user;`로 연결 대상을 확인할 수 있다. 테이블 생성은 수동 복사 대신 저장소의 db:migrate로 한다.

## 개발 환경

새로 만드는 프로젝트라면 **운영 migration/로그인/데이터 입력 전에** 빈 운영 브랜치에서 development 브랜치를 생성할 수 있다. 두 브랜치 각각 Connect에서 별도 URL을 가져오고 각 환경에서 db:migrate를 실행한다. 개발 BETTER_AUTH_SECRET은 운영과 다르게 생성한다.

운영 데이터가 이미 있다면 개발용 빈 프로젝트를 별도로 만드는 것이 가장 단순하다. 기존 데이터가 포함된 브랜치를 만들 경우 DB뿐 아니라 사용자·세션·OAuth 키도 복제된다. 새 secret으로 바꾸기만 하면 암호화된 기존 키와 맞지 않을 수 있다. 인증 데이터 정리를 임의 실행하지 말고 복제 목적/처리 범위를 정한다. 현재 저장소에 연결된 development는 이 분리 작업을 완료한 기존 환경이다.

브랜치는 생성 시점의 사본이며 운영 쓰기를 계속 동기화하지 않는다. 운영 브랜치 reset/restore/delete는 일상 개발 작업이 아니다. [브랜칭 원리](https://neon.com/docs/get-started-with-neon/workflow-primer)

## 연결 확인·문제 해결

[배포 문서](../deployment.md)의 비밀 값 없는 연결 대상 확인 명령을 실행한 뒤 `npm run db:migrate`(개발)를 사용한다. 운영은 반드시 명시적 운영 환경 파일 명령을 사용한다.

| 증상 | 확인 |
|---|---|
| 연결 시간 초과 | compute 활성 상태, 네트워크, hostname/포트, 지역, suspend 후 첫 연결 지연 |
| password authentication failed | 선택 role과 해당 비밀번호, 복사 누락, URL 인코딩. 전체 URL을 로그에 남기지 않음 |
| relation does not exist | 올바른 branch/database인가, 모든 migration이 적용됐는가 |
| 운영 데이터가 안 보임 | development는 별도 사본. 운영을 로컬 개발에 연결해서 해결하지 않음 |
| 연결 수 초과 | pooled URL 여부, pg Pool 설정, 같은 프로세스에 중복 Pool을 만들었는가 |

콘솔의 복구 보존 기간과 사용량을 정기적으로 확인한다. DB 브랜치만을 유일한 백업으로 삼지 않는다. 와인 사진도 DB 용량을 사용한다. 전체 백업과 복구 검증은 [운영 문서](../deployment.md)를 따른다.
