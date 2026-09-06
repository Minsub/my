# 개인 데이터 통합 관리 앱 — 아키텍처 설계 (v2)

> 이 문서는 구현을 맡을 코딩 에이전트가 참고할 설계 스펙입니다. v1에서 Supabase 기반으로 초안을 잡았으나, 요구사항을 재검토하며 v2에서 Neon + 커스텀 MCP 서버로 확정되었습니다.

## 1. 프로젝트 개요

- **목적**: 와인 셀러, 커피 원두 등 실생활 데이터를 하나의 앱에서 통합 관리 + 시각화
- **입력 경로 2가지**
  1. AI 에이전트 (직접 만든 도메인 특화 MCP 서버를 통해)
  2. 웹 UI (사람이 직접 입력)
- **조회 방식**: 실시간 구독 없이, 사람이 "조회(fetch)" 버튼을 눌러 필요할 때 가져오는 방식
- **현재 상태 (마이그레이션 대상)**
  - 와인 셀러: Airtable로 관리 중 (base `appop5NIlidjqK1iW`, table `tblCJybtil7UA662V`)
  - 커피 원두: Google Apps Script Webhook API로 관리 중
- **운영 방침**: 개발자 본인이 서버/프론트 모두 개발 가능하나, 인프라 운영 부담을 최소화하는 방향으로 결정
- **1인 전용 앱**: 사용자가 본인 한 명뿐이므로 Auth, 여러 사용자를 전제로 한 보안 장치는 불필요

## 2. 핵심 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 호스팅 | Vercel (Next.js 단일 레포 — 프론트 + 서버리스 API + MCP 서버) |
| DB | **Neon** (플레인 Postgres) — Supabase 아님 |
| 데이터 접근 방식 | 프론트/에이전트 모두 **서버(서버리스 API 또는 MCP)를 경유**해서만 DB 접근. 프론트가 DB를 직접 조회하지 않음 |
| Auth | 불필요 |
| Storage | 거의 안 씀 (필요해지면 Vercel Blob 검토, 후순위) |
| Realtime | 불필요 — 수동 "조회" 버튼 방식 |
| MCP | 직접 설계한 도메인 특화 MCP 서버 (Supabase 공식 MCP 커넥터는 사용 안 함) |

## 3. 전체 구조

```
                 ┌──────────────────────────┐
   AI Agent  ───▶│  MCP 서버 (Vercel 함수)   │──┐
                 │  도메인 특화 tool         │  │
                 └──────────────────────────┘  │
                                                ▼
   사람(웹)   ───▶  "조회" 버튼 클릭      ──▶  서버리스 API  ──▶  Neon (Postgres)
              (Next.js 프론트엔드, Vercel)
```

- 프론트는 DB에 직접 접근하지 않으므로 RLS, PostgREST, Data API 노출 설정 같은 개념 자체가 필요 없음
- DB 커넥션 스트링(`DATABASE_URL`)은 서버 쪽 환경변수에만 존재, 브라우저에는 절대 노출되지 않음
- Neon은 Vercel 마켓플레이스 통합으로 연결 — 연결 시 관련 환경변수가 자동 주입됨
- Neon의 브랜치 기능을 활용하면 PR/브랜치별로 격리된 DB 브랜치를 자동으로 만들 수 있음 (선택 사항)

## 4. 레포 구조 (모노레포 1개)

```
my-app/
├── app/                     # Next.js 프론트엔드 (대시보드, 입력 폼, 조회 버튼)
├── app/api/                 # 서버리스 함수 — 조회 API, 커스텀 비즈니스 로직 (추천 등)
├── app/api/mcp/             # MCP 서버 라우트 (@vercel/mcp-adapter 사용)
├── db/
│   ├── schema.ts            # DB 스키마 정의 (ORM은 구현 단계에서 확정, 후보: Drizzle/Prisma)
│   └── migrations/          # 스키마 변경 이력
├── package.json
└── vercel.json
```

- Vercel은 `app/` 쪽을 보고 프론트 + 서버리스 함수 + MCP 서버를 빌드/배포 (git push 시 자동)
- 시크릿(`DATABASE_URL` 등)은 레포에 커밋하지 않고 Vercel 환경변수로만 관리

## 5. 컴포넌트별 역할

### 5.1 Vercel
- **프론트엔드**: 와인/원두 대시보드, 수동 입력 폼, "조회" 버튼, 시각화(차트)
- **서버리스 API**: 조회 엔드포인트 + 커스텀 로직(추천 알고리즘, 집계 등) — DB에 표준 Postgres 드라이버(예: `postgres.js`, Drizzle 등)로 직접 접속
- **MCP 서버**: AI 에이전트가 호출하는 도메인 특화 tool 노출
  - 실행 모델: Fluid Compute 기반 서버리스 — stateless 설계 권장
  - raw SQL 실행형 tool은 만들지 않음 (보안·안정성 이유 — 아래 8절 참고)
  - 예상 tool 후보(추후 구체화): `add_wine`, `log_tasting`, `recommend_pairing`, `add_coffee_bean`, `log_brew_setting` 등

### 5.2 Neon
- 플레인 Postgres DB만 제공 (Auth/Storage/Realtime 없음 — 이번 프로젝트엔 애초에 불필요했던 기능이라 손해 아님)
- 비활성 시 자동 슬립 → 다음 요청 시 자동으로 재가동 (Supabase처럼 대시보드에서 수동으로 깨울 필요 없음)
- git 브랜치별 DB 브랜치 기능 제공 (원하면 활용)

## 6. 데이터 접근 패턴 (단일 경로로 단순화)

이전 v1에서 검토했던 "프론트가 DB를 직접 조회하는 패턴"은 폐기되었습니다. 이유:
- Auth/Realtime을 안 쓰기로 하면서 그 패턴의 장점(즉석 API, RLS로 보호된 직접 접근, 실시간 구독)이 전부 의미가 없어짐
- 유일한 경로: **프론트 또는 AI 에이전트 → 서버리스 API/MCP 서버 → Neon**
- 이 구조에서는 anon key/service role key 구분이 필요 없고, DB 커넥션 스트링 하나만 서버 쪽에 안전하게 보관하면 됨

## 7. MCP 서버 설계 원칙

- 도메인 특화 tool 단위로 설계 (범용 SQL 실행 tool 금지)
- 각 tool은 명확한 입력 스키마와 설명(description)을 가져서 에이전트가 안정적으로 호출하도록 함
- 서버리스 API와 같은 서비스 레이어(DB 접근/비즈니스 로직 함수)를 공유해서 로직 중복 방지

## 8. 검토했던 대안과 미채택 이유 (기록용)

- **Supabase**: Auth·Storage·Realtime이 번들된 게 강점이지만, 1인 전용 앱이라 셋 다 실제로는 불필요하다고 판단. 남는 가치가 "매니지드 Postgres" 정도뿐이라, 그 좁은 비교에서는 Neon이 Vercel 통합과 비활성 시 자동 재가동(수동 unpause 불필요) 면에서 더 적합
- **Supabase 공식 MCP 커넥터**: 실제로는 `execute_sql`, `apply_migration`, `list_tables` 등 스키마 관리·SQL 실행용 개발/운영 도구이지, "에이전트가 도메인 데이터를 입력"하는 이번 핵심 기능에 맞는 도구가 아님. 스키마 드리프트에 취약하고, raw SQL 실행 권한을 에이전트에 열어주는 데 따른 보안 리스크도 있어 미채택
- **맥미니 2011 / Oracle Cloud**: 인프라 운영 부담 최소화가 우선이라 프로덕션 호스팅에서는 미채택, 로컬 개발/백업 용도로만 고려

## 9. 아직 미정 — 구현 시 확정 필요

- [ ] Postgres 스키마 설계 (와인/원두를 공통 패턴으로 묶을지, 도메인별로 분리할지)
- [ ] ORM/마이그레이션 도구 선택 (Drizzle vs Prisma 등)
- [ ] Airtable → Neon, Google Apps Script(Sheets) → Neon 데이터 마이그레이션 스크립트
- [ ] MCP tool 목록 및 각 tool의 입출력 스펙 확정
- [ ] Claude.ai / Claude 앱에 remote MCP 커넥터로 등록하는 구체적 절차 확인 (현재 제품 문서 기준으로 재확인 필요)
- [ ] 향후 새로운 데이터 도메인 추가 시 확장 방식 (테이블 추가 + MCP tool 추가 패턴 정립)
- [ ] DB 백업 전략 (Neon 자체 백업 정책 확인 + 필요 시 정기 덤프 스크립트)
