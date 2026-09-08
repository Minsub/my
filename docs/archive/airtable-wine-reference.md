# 과거 Airtable 와인 운영 자료 — 실행하지 않음

이관 당시 필드 매핑과 요구사항 보존용이다. 아래 호출·수량 갱신·ID 발급 절차는 MONO에서 사용하지 않는다. 현재 지침은 [와인 작업 지침](../wine-celler/skill.md)이다.


# 와인 셀러 관리 스킬

4가지 기능 운영: **와인 추가 / 와인 소비 / 와인 추천 / 와인 목록 조회**

---

## Airtable 연결 정보

### 🍾 와인 DB
- **Base ID:** `appop5NIlidjqK1iW`
- **Table ID:** `tblCJybtil7UA662V`
- **Interface ID:** `pbdwBZJEgFDtPxAjl`
- **Page ID:** `pag4BdObo3xJ20jkO`

### 🥂 와인잔 DB
- **Base ID:** `appCHvxtjCUNWnPtm`
- **Table ID:** `tblOQwMY7CqTZs6yf`
- **Interface ID:** `pbd8BTgJ6CKWH5c4e`
- **Page ID:** `pagE9hCcag1SVyidK`

> **⚠️ 조회 방식 중요:**
> `list_records_for_table`은 이 MCP 플랜에서 **미지원**. 와인 DB, 와인잔 DB 모두 `list_records_for_page`를 사용할 것.

---

## 데이터베이스 스키마

### 🍾 와인 DB 필드 ID 매핑

| 필드 | Field ID | 타입 | 비고 |
|------|----------|------|------|
| 한글 이름 | `fldaoCORde1HgHRok` | singleLineText | primary |
| 영어 이름 | `fldXCZpzp2O8LXsoS` | singleLineText | |
| ID | `fldrhZQqGGTvbLjwE` | number | 수동 auto-increment |
| 종류 | `fld6m7oC81YO6GdTj` | singleSelect | 레드, 화이트, 로제, 스파클링, 디저트, 주정강화 |
| 나라 | `fld8oBT8wEfx3YlGJ` | singleSelect | 프랑스, 이탈리아, 스페인, 미국, 칠레, 아르헨티나, 호주, 뉴질랜드, 독일, 포르투갈, 한국, 기타 |
| 지역 | `fldhcDBxjCvKg2QsC` | singleLineText | |
| 품종 | `fldjNDuzP5cgkzPoK` | singleLineText | |
| 빈티지 | `fldjwUPrIPf6xh1ZG` | number | |
| 수량 | `fldyNUSLA0nT6dlsY` | number | |
| 구매가 | `fld0m5t84qxbQp4ik` | currency (₩) | |
| 구매일 | `fld5cHoRn1Wn1Ew2o` | date (YYYY-MM-DD) | |
| 점수 | `fld7e7VVcoVqfGNix` | number (0~100) | 선택 입력 |
| 시음 노트 | `fld9pRh46AZMvU7mc` | multilineText | 선택 입력 |
| 재구매 의사 | `fld8ubX9hq3YibAet` | checkbox | true=Y, false=N |

**ID auto-increment 처리:**
Airtable은 자동 증가를 지원하지 않으므로, 와인 추가 시:
1. `list_records_for_page` (interfaceId: `pbdwBZJEgFDtPxAjl`, pageId: `pag4BdObo3xJ20jkO`)로 전체 항목 조회
2. 가장 큰 ID 값 + 1을 새 ID로 사용
3. 첫 항목이면 ID = 1

### 🥂 와인잔 DB 필드 ID 매핑

| 필드 | Field ID | 타입 |
|------|----------|------|
| 잔 이름 | `fld8oBteROD0KFXyt` | singleLineText (primary) |
| 브랜드 | `fldg7f56JDNetmeVw` | singleSelect |
| 잔 종류 | `fldhYyqjxobkbO6g7` | singleSelect (보르도형, 부르고뉴형, 유니버설, 화이트와인형, 샴페인 플루트, 샴페인 쿠페, 디저트/포트, 리델-쉬라, 리델-샴페인&리슬링, 리델-사케) |
| 메모 | `fldfn8FOoyhlmHCfR` | singleLineText |

---

## 1. 와인 추가

### 입력
- 라벨 사진 (이미지에서 와인 정보 추출)
- 수량, 구매가
- 점수, 시음 노트, 재구매 의사 (선택 — 입력 없으면 비워둠)

### 처리 흐름
1. 라벨 사진에서 한글 이름, 영어 이름, 나라, 지역, 품종, 종류, 빈티지 추출
2. `list_records_for_page` (interfaceId: `pbdwBZJEgFDtPxAjl`, pageId: `pag4BdObo3xJ20jkO`)로 같은 와인(영어 이름 + 빈티지 기준) 이미 존재하는지 확인
   - **신규** → `create_records_for_table` (tableId: `tblCJybtil7UA662V`)로 새 항목 생성 (ID auto-increment, 구매일=오늘). 점수/시음 노트/재구매 의사가 있으면 함께 저장
   - **기존 와인** → `update_records_for_table`로 수량만 추가 (구매가, 구매일은 기존 값 유지). 점수/재구매 의사가 있으면 덮어씀
   - **시음 노트 공통 규칙:** 저장 시 `(YYYY-MM-DD)` 날짜를 앞에 자동 추가. 기존 노트가 있으면 줄바꿈 후 이어 붙임 (덮어쓰지 않음)

### 응답 형식
```
✅ [신규 추가 / 수량 업데이트]

#[ID] 한글이름 (English Name) · 빈티지
🌍 나라 > 지역 | 🍇 품종 | 종류
📦 수량: N병 · 💰 구매가: N원
⭐ 점수: N/100 · 📝 [시음 노트 한 줄 요약] · 🔁 재구매: Y/N
```
(점수/시음 노트/재구매 의사가 없으면 해당 줄 생략)

---

## 2. 와인 소비

### 입력
- 와인 이름 또는 ID
- 소비 수량 (미입력 시 기본값: 1병)
- 점수, 시음 노트, 재구매 의사 (선택 — 소비 후 함께 입력 가능)

### 처리 흐름
1. `list_records_for_page` (interfaceId: `pbdwBZJEgFDtPxAjl`, pageId: `pag4BdObo3xJ20jkO`)로 전체 조회 후 ID 또는 이름으로 필터
   - 복수 결과 시 사용자에게 선택지 제시
2. 현재 수량 확인
   - 수량 > 소비량 → `update_records_for_table`로 수량 차감
   - 수량 = 소비량 → 차감 후 "재고 없음" 안내
   - 수량 < 소비량 → 경고 후 사용자 확인
3. 점수/시음 노트/재구매 의사가 함께 제공된 경우 → 수량 차감과 동시에 해당 필드도 업데이트
4. 시음 노트 저장 시 앞에 오늘 날짜를 `(YYYY-MM-DD)` 형식으로 자동 추가
   예: `(2026-05-21) 시트러스한 향이 아주 좋음`
   기존 시음 노트가 있으면 줄바꿈 후 새 노트를 이어 붙임 (덮어쓰지 않음)

### 응답 형식
```
🍷 [한글이름] (#[ID])
📦 [이전 수량]병 → [잔여 수량]병 (-[소비량])
⭐ 점수: N/100 · 🔁 재구매: Y/N
📝 [시음 노트]
```
(점수/시음 노트/재구매 의사 미입력 시 해당 줄 생략)

---

## 3. 와인 추천

### 입력
- 음식 또는 상황 설명 (자유 입력)

### 처리 흐름
1. `list_records_for_page` (interfaceId: `pbdwBZJEgFDtPxAjl`, pageId: `pag4BdObo3xJ20jkO`) → 수량 > 0인 항목만 필터
2. `list_records_for_page` (interfaceId: `pbd8BTgJ6CKWH5c4e`, pageId: `pagE9hCcag1SVyidK`) → 와인잔 전체 조회
3. 입력된 음식/상황에 맞는 와인 3개 선정
4. 각 와인에 대해 응답 구성

### 응답 형식
```
## 🍷 오늘의 와인 추천

### 1순위: [한글이름] (#[ID])
- **빈티지:** [연도] | **종류:** [종류] | **품종:** [품종]
- **추천 이유:** [음식/상황과 어울리는 이유]
- **와인 특징:** [맛, 향, 바디감 설명]
- **적정 온도:** [N]℃
- **추천 잔:** [보유 잔 중 최적 / 없으면 "보르도형 권장"]
- **디켄터 사용 추천:** [디켄팅 추천여부, 추천 이유]
- **Vivino:** [https://www.vivino.com/search/wines?q=영어이름+빈티지]

### 2순위: ...
### 3순위: ...
```

**Vivino 링크 형식:**
`https://www.vivino.com/search/wines?q=[영어이름을+URL인코딩+빈티지]`
예: `https://www.vivino.com/search/wines?q=Opus+One+2019`

**잔 추천 로직:**
- 레드 풀바디 → 보르도형
- 레드 라이트바디 (피노 누아 등) → 부르고뉴형
- 화이트/로제 → 화이트와인형 or 유니버설
- 스파클링 → 샴페인 플루트 or 쿠페
- 보유 잔 목록과 대조 후 보유 중이면 해당 잔 이름 명시, 없으면 종류만 권장

---

## 4. 와인 목록 조회

### 처리 흐름
1. `list_records_for_page` (interfaceId: `pbdwBZJEgFDtPxAjl`, pageId: `pag4BdObo3xJ20jkO`, pageSize: 100)로 단일 호출로 전체 조회
2. 종류별 그룹화하여 표 또는 카드 형식으로 정리

---

## 오류 처리

- **항목 못 찾음** → "검색 결과가 없습니다. ID나 이름을 다시 확인해주세요."
- **수량 부족** → "현재 N병 보유 중입니다. N병만 소비할까요?"
