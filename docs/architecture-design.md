# 개인 데이터 통합 관리 앱 — 아키텍처 설계

> 이 문서는 구현을 맡을 코딩 에이전트가 참고할 설계 스펙입니다. 대화를 통해 결정된 내용만 담았고, 세부 스키마/코드는 구현 단계에서 확정합니다.

## 1. 프로젝트 개요

- **목적**: 와인 셀러, 커피 원두 등 실생활 데이터를 하나의 앱에서 통합 관리 + 시각화
- **입력 경로 2가지**
  1. AI 에이전트 (MCP 서버를 통해)
  2. 웹 UI (사람이 직접 입력)
- **현재 상태 (마이그레이션 대상)**
  - 와인 셀러: Airtable로 관리 중 (base `appop5NIlidjqK1iW`, table `tblCJybtil7UA662V`)
  - 커피 원두: Google Apps Script Webhook API로 관리 중
- **운영 방침**: 개발자 본인이 서버/프론트 모두 개발 가능하나, 이번 프로젝트는 인프라 운영 부담을 최소화하는 방향으로 결정

## 2. 검토했던 호스팅 옵션과 최종 결론

| 옵션 | 특징 | 채택 여부 |
|---|---|---|
| 맥미니 2011 (자택) | 보유 자산, 그러나 노후 하드웨어 + 공인 IP 없음 + 가정용 회선 신뢰성 문제 | ❌ 프로덕션 제외 — 로컬 개발/백업용으로만 고려 |
| Oracle Cloud Always Free | 이미 TeslaMate 운영 중인 ARM 인스턴스(2 OCPU/12GB), DuckDNS+Nginx+Let's Encrypt 세팅 재사용 가능 | 대안으로 유효하나, 운영 부담(패치·백업)이 이번 목표와 안 맞아 미채택 |
| **Vercel + Supabase** | 인프라 관리 최소화, 관리 포인트가 코드 위주 | ✅ **채택** |

## 3. 전체 구조

```
                 ┌──────────────────────┐
   AI Agent  ───▶│  MCP 서버 (Vercel)    │──┐
  (Claude 등)     │  @vercel/mcp-adapter │  │
                 └──────────────────────┘  │
                                            ▼
   사람(웹)   ───▶  Next.js 프론트엔드   ──▶  Supabase
              (대시보드 + 입력 폼, Vercel)   (Postgres + Auth + Storage + Realtime)
```

- **레포는 1개, 배포 대상(인프라)은 2개**: Vercel(코드 배포) + Supabase(클라우드 DB 인스턴스)
- Supabase 프로젝트는 레포가 아니라 실제로 떠 있는 클라우드 인프라. 레포 안의 `supabase/` 폴더는 그 인스턴스를 조종하는 설정/마이그레이션 코드일 뿐.

## 4. 레포 구조 (모노레포 1개)

```
my-app/
├── app/                     # Next.js 프론트엔드 (대시보드, 입력 폼)
├── app/api/                 # 서버리스 함수 — 커스텀 비즈니스 로직 (추천 등)
├── app/api/mcp/             # MCP 서버 라우트 (@vercel/mcp-adapter 사용)
├── supabase/
│   ├── config.toml
│   ├── migrations/          # 스키마 변경 이력 (Flyway/Liquibase와 유사한 개념)
│   └── functions/           # Supabase Edge Functions (필요 시)
├── package.json
└── vercel.json
```

- Vercel은 `app/` 쪽을 보고 프론트 + 서버리스 함수를 빌드/배포 (git push 시 자동)
- Supabase CLI는 `supabase/` 쪽을 보고, `supabase link --project-ref <ref>`로 연결된 클라우드 인스턴스에 마이그레이션 반영
- 두 흐름을 GitHub Actions로 묶으면 push 한 번에 프론트/API 배포 + DB 마이그레이션이 동시에 실행되도록 자동화 가능
- 시크릿(Supabase service role key, `supabase link` access token 등)은 레포에 커밋하지 않고 Vercel 환경변수 / GitHub Actions secrets로만 관리

## 5. 컴포넌트별 역할

### 5.1 Vercel
- **프론트엔드**: 와인/원두 대시보드, 수동 입력 폼, 시각화(차트)
- **서버리스 API**: RLS만으로 표현하기 어려운 커스텀 로직 (추천 알고리즘, 복잡한 집계 등)
- **MCP 서버**: AI 에이전트가 호출하는 도메인 특화 tool 노출
  - 실행 모델: Fluid Compute 기반 서버리스 — stateless 설계 권장, 세션 필요 시 별도 저장소(Redis 등) 고려
  - 예상 tool 후보(추후 구체화): `add_wine`, `log_tasting`, `recommend_pairing`, `add_coffee_bean`, `log_brew_setting` 등

### 5.2 Supabase
- **Postgres DB**: 도메인별 테이블(wines, coffee_beans 등) — 스키마는 구현 단계에서 설계
- **Auth**: 1인 전용 앱이라 필요 최소한으로 (또는 API 키 인증으로 대체 검토)
- **RLS (Row Level Security)**: 프론트가 DB를 직접 조회하는 경로의 보안 근간
- **Storage**: 와인 라벨 / 원두 봉투 사진
- **Realtime**: MCP로 데이터가 추가되면 폴링 없이 대시보드가 즉시 갱신
- **Data API 노출 설정**: 2026-05-30 이후 신규 프로젝트는 테이블이 기본적으로 API에 비노출 → 프론트에서 직접 조회할 테이블은 각각 수동으로 opt-in 필요 (구현 시 누락 주의)

## 6. 데이터 접근 패턴 (2가지 병행)

| 패턴 | 경로 | 인증 키 | 용도 |
|---|---|---|---|
| A. 직접 접근 | 프론트 → `supabase-js` → PostgREST/GraphQL/Realtime | anon key (RLS로 보호) | 단순 CRUD, 조회, 대시보드 |
| B. 서버 경유 | 프론트 또는 AI 에이전트 → Vercel 서버리스/MCP 서버 → Supabase | service role key (서버 전용, 절대 클라이언트 노출 금지) | 복잡한 로직, 추천, 검증이 필요한 쓰기 |

**원칙**: 단순 조회/입력은 A, 비즈니스 로직이 개입되는 부분은 B.

## 7. 아직 미정 — 구현 시 확정 필요

- [ ] Postgres 스키마 설계 (와인/원두를 하나의 공통 패턴으로 묶을지, 도메인별로 완전히 분리할지)
- [ ] Airtable → Supabase, Google Apps Script(Sheets) → Supabase 데이터 마이그레이션 스크립트
- [ ] MCP tool 목록 및 각 tool의 입출력 스펙 확정
- [ ] 1인 전용 앱에서 Auth를 실제로 쓸지, API 키 인증만으로 충분한지 결정
- [ ] Claude.ai / Claude 앱에 remote MCP 커넥터로 등록하는 구체적 절차 확인 (현재 Claude 제품 문서 기준으로 재확인 필요)
- [ ] 향후 새로운 데이터 도메인 추가 시 확장 방식 (테이블 추가 + MCP tool 추가 패턴 정립)
