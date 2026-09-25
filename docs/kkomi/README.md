# 꼬미 — 임신 중 통증 기록

꼬미는 아이 태명이며 메뉴 이름이다(URL은 `/baby`). 첫 하위 화면은 `/baby/pregnancy`의 임신 중 통증 기록이다. 자궁수축으로 오는 배뭉침과 통증을 시작·종료 탭으로 기록하고 주기를 보며, 출혈은 시각과 사진으로 남긴다. 모바일이 주 사용 환경이다. 2026-09-25 코드 기준.

## 화면

| 영역 | 동작 |
|---|---|
| 상단 | 출산예정일로 계산한 주수(40주 0일 = 예정일). 누르면 예정일 설정 |
| 지금 기록 · 요약 | 최근 1시간의 배뭉침·통증 횟수, 평균 간격, 평균 지속, 상태 표시와 안내 문구 |
| 지금 기록 · 타일 | 배뭉침·통증 타일을 누르면 시작, 다시 누르면 종료. 두 타입은 따로 돌아 동시에 켤 수 있다 |
| 종료 직후 시트 | 이미 저장된 기록에 강도(약·중·강)와 메모를 선택으로 붙인다. 삭제 가능 |
| 출혈 기록 | 시각, 출혈 여부(출혈 없음·묻어남·소량·중간·많음, 필수), 색(출혈일 때만, 선택), 사진 최대 4장, 메모 |
| 직접 입력 | 누르지 못한 배뭉침·통증을 시작·종료 시각(초 단위)으로 추가. 목록 행을 누르면 같은 시트로 수정·삭제 |
| 최근 3시간 흐름 | 타입별 막대. 출혈은 점, 출혈 없음은 빈 점 |
| 타입별 보기 | 한 페이지 안에서 배뭉침·통증·출혈 전환. 기간(최근 1시간·오늘·전체), 요약 3칸, 오늘 시간대별 횟수(1시간 4회 점선), 날짜별 세로 타임라인(시작·지속·번호·간격) |
| 출혈 목록 | 확인·출혈·사진 수 요약. 사진은 흐리게 보이고 한 번 누르면 선명, 다시 누르면 전체 화면 |

보기 상태는 URL에 남긴다: `?tab=type&kind=pain&range=all`.

## 계산 규칙

`src/lib/pregnancy.ts`가 화면과 서버의 단일 기준이다. 기준값은 사용자가 바꾸지 않는 상수다.

- 지속시간 = 종료 − 시작.
- 간격 = 같은 타입의 이전 시작 → 이번 시작. 60분(`SESSION_GAP_MIN`)보다 길면 간격을 잇지 않고 "새 구간"으로 센다.
- 화면의 간격은 시각과 헷갈리지 않게 "9분 12초"로, 지속은 "0:42"로 쓴다.
- 상태는 배뭉침·통증을 각각 계산해 더 높은 쪽을 쓴다.
  - 잦아지는 중: 최근 60분에 시작한 기록 4회 이상.
  - 병원 연락 권장: 최근 20분 4회 이상 또는 최근 60분 8회 이상.
  - 37주 이후면 병원 연락 권장 문구에 5-1-1(5분 간격·1분 지속·1시간 유지) 안내를 더한다.
- 한 번의 배뭉침·통증은 60분을 넘을 수 없다(DB CHECK). 타이머를 60분 넘게 켜두고 종료하면 저장하지 않고 직접 입력 시트를 열어 종료 시각을 고치게 한다.

### 기준의 근거

상태 표시는 참고용이며 진단이 아니라는 문구를 화면에 둔다. 판정에는 자궁경부 변화처럼 앱이 알 수 없는 정보가 빠져 있다.

- 조기진통은 20분 4회·1시간 8회 이상의 수축과 자궁경부 변화로 진단한다([서울아산병원 질환백과](https://www.amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do?contentId=31952), [MD투데이](https://www.mdtoday.co.kr/news/view/1065599590913314)).
- 평상시 배뭉침은 하루 3~10회, 대개 10~20초 안에 풀리며, 1시간 3회 이상이면 상담을 권한다(MD투데이 병원 인터뷰).
- ACOG 조기진통 경고 신호: 10분마다 또는 더 자주 오는 규칙적 수축, 질 출혈이나 분비물 변화, 허리의 둔한 통증, 골반 압박, 생리통 같은 경련([ACOG](https://www.acog.org/womens-health/faqs/preterm-labor-and-birth)).
- 만삭 분만 진통의 5-1-1([UT Southwestern](https://utswmed.org/medblog/braxton-hicks-contractions/)).
- 화면 구성은 순산해요(요약 3칸·타임라인)와 눕눕생활(부드러운 카드·큰 탭 영역) 앱을 참고했다.

## 진행 중 타이머와 저장

- 진행 중 타이머는 **입력하는 기기의 localStorage**(`mono:kkomi:running:v1:{userId}`)에만 있다. 새로고침하거나 브라우저가 탭을 다시 불러와도 시작 시각이 남는다. 다른 기기나 구성원에게는 진행 중 상태가 보이지 않는다. 한 기기로 계속 입력한다는 전제다.
- 종료하면 완성된 기록을 먼저 `mono:kkomi:pending:v1:{userId}`에 넣고 서버로 보낸다. 성공하면 대기 목록에서 지운다. 연결이 끊기면 대기 목록에 남아 "저장 대기 N건"으로 보이고, 페이지를 열 때·`online` 이벤트·"지금 저장"에서 다시 보낸다. 4xx 오류(429 제외)는 다시 보내도 같으므로 대기에서 지우고 알린다.
- 재전송은 클라이언트가 만든 `request_key`로 한 건만 남긴다(`UNIQUE(household_id, request_key)`).
- 기록 중에는 Screen Wake Lock을 요청한다. 지원하지 않는 브라우저에서는 조용히 넘어간다.
- 출혈 사진은 localStorage에 넣지 않는다. 출혈 저장이 실패하면 시트에 오류를 보이고 입력을 유지한다.

## 데이터

`db/migrations/008_pregnancy.sql`.

| 테이블 | 내용 |
|---|---|
| `pregnancy_settings` | 공간당 1행. `due_date`, `version` |
| `pregnancy_events` | `kind`(`tightening`·`pain`·`bleeding`), `started_at`, `ended_at`, `intensity`(1~3), `bleeding`(`none`·`spotting`·`light`·`moderate`·`heavy`), `bleeding_color`(`brown`·`pink`·`red`·`dark`), `memo`(500자), `request_key`, `version`, 작성·수정자 |
| `pregnancy_photos` | 출혈 사진. 와인 사진과 같은 `normalizePhoto`(회전 보정·1000px·WebP·300KB 이하)를 거친 결과만 저장. 원본은 저장하지 않는다 |

- 배뭉침·통증은 종료가 있어야 하고 출혈 필드를 갖지 않는다. 출혈은 종료·강도가 없고 출혈 여부가 필수이며 `none`이면 색이 없다(CHECK).
- 기록의 타입은 배뭉침↔통증끼리만 바꿀 수 있다. 출혈과 서로 바꾸지 않는다.
- 사진은 기록당 최대 4장. 수정할 때 남길 사진 id와 새 사진을 함께 보내며 순서를 다시 매긴다.
- 브라우저는 사진을 1200px JPEG로 줄여 보낸다. 요청 본문은 4MB 이하다(Vercel 한도 4.5MB).

## 권한과 경계

- 웹 전용. `actor.channel !== "web"`이면 거부하고 MCP 도구·scope를 추가하지 않았다(2026-09 결정).
- 모든 조회·수정은 인증된 Actor의 `household_id` 조건을 쓴다. 공간의 활성 구성원만 읽는다.
- 수정·삭제는 기록한 사람 또는 관리자만 가능하고 `expected_version`이 맞아야 한다(409 `VERSION_CONFLICT`).
- 사진은 `/api/baby/pregnancy/photo/{id}`로만 내보내며 `private, no-store`다.
- 데모(`/demo?view=/baby/pregnancy`)는 `src/lib/demo-pregnancy.ts`의 예시 기록을 보여주고 시작·저장을 막는다. 사진은 표시하지 않는다.

## API

| 요청 | 내용 |
|---|---|
| `GET /api/baby/pregnancy` | `{ settings, events }`. 최근 5000건 |
| `POST /api/baby/pregnancy` | `action`: `create`(request_key), `update`(id, expected_version, keep_photo_ids), `delete`(id, expected_version), `settings`(due_date, expected_version; 처음은 0) |
| `GET /api/baby/pregnancy/photo/{id}` | WebP 사진 |

## 현재 없는 것

태동·투약 기록, 알림(푸시), PDF 리포트, 기준값 변경, 여러 기기 간 진행 중 타이머 공유는 없다.
