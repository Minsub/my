# MONO — 화면과 도메인 기준

## 제품 방향

MONO / Personal Workspace. 필요한 데이터를 저장하고 시각화하며 AI로 조회·기록하는 개인 앱이다. 커피와 와인은 첫 도구이며 이후 책·여행·자산 등 독립 페이지를 추가할 수 있다. 새 모듈은 실제 요청이 있을 때 구현한다.

가족 공유는 기능이다. 홈·메뉴·소개를 가족 서비스로 표현하지 않는다. 구성원 관리, 작성자 구분, 공유 권한 안내에는 필요한 정보를 정확히 표시한다. 내부 household 필드와 인증은 유지한다.

## 현재 화면

| URL | 현재 역할 | 구현 위치 |
|---|---|---|
| `/` | 도구 진입 카드, 모듈별 요약, 최근 활동, MCP 안내 이동 | workspace-home.tsx |
| `/coffee` | 정보형 원두 목록, 가격 정렬·브랜드·상태·추천·사용자·검색·보관함 | app-shell.tsx renderCoffee |
| `/coffee/brands` | 브랜드 목록·등록·수정·브랜드별 원두 바로가기 | app-shell.tsx |
| `/coffee/beans/{uuid}` | 상품·kg 환산 가격·사용자별 평가·추출 설정 | app-shell.tsx |
| `/wine` | 보유량 대시보드, 확장 필터·정렬·가격 목록 | wine-cellar.tsx |
| `/wine/{uuid}` | 정보·입고·소비·취소·시음·사진 | app-shell.tsx, wine-photo-upload.tsx |
| `/wine/glasses` | 와인잔 등록·수정 | app-shell.tsx |
| `/cash` | 엑셀 원본 기반 요약·분류 분석·거래 조회·파일 관리 | cash-dashboard.tsx, cash-files.tsx |
| `/settings` | 구성원·머신·AI 연결·도구별 MCP 안내 | app-shell.tsx, connections.tsx, mcp-guide.tsx |
| `/login`, `/consent`, `/privacy`, `/setup` | 인증·동의·개인정보·미설정 안내 | src/app 하위 경로 |
| `/demo?view=/wine` 등 | 읽기 전용 샘플 둘러보기. 실제 DB를 읽지 않음 | demo/page.tsx, lib/demo.ts |

## 화면을 추가·수정할 때

- 담백한 한국어 설명과 MONO 표기를 사용한다. 감성 문구나 커피·와인을 앱 전체 정체성으로 확대하지 않는다.
- 홈은 도구를 여는 곳이다. 한 도메인의 추천 카드로 홈을 채우지 않는다. 새 모듈을 제공하면 홈 카드와 메뉴를 함께 검토한다.
- PC는 사이드바·비교 가능한 넓은 행, 모바일은 하단 내비게이션·카드·44px 이상 주요 터치 영역이다. 새 메뉴가 늘면 하단 5개 이상을 억지로 밀어넣지 말고 더보기/도구 목록 구조를 설계한다.
- `globals.css`의 변수와 button/panel/폼을 재사용하고 새 화면은 접두사 있는 클래스로 한정한다. 전역 태그 스타일 변경은 기존 페이지도 확인한다.
- 빈 값, 재고 없음, 긴 이름, 데이터 없음, 로딩·실패·충돌 상태를 제공한다. 미입력과 0/false를 구분한다.
- 필터는 URL에 보존한다. 커피는 두 탭과 상세의 목록 복귀에서 필터·정렬을 보존한다. 다른 도메인은 실제 링크 구현을 확인한다.
- 연결과 권한 처리는 UI만으로 끝내지 않는다. 서버 검증이 기준이다.

## 커피 데이터 의미

`coffee_brands`, `coffee_beans`, `coffee_preferences`, `coffee_machines`, `coffee_brew_settings`를 사용한다. 실제 컬럼/제약은 migrations와 types.ts를 확인한다. 상품과 본인의 평가를 분리하며 세팅은 누적 기록이다.

가격은 포장 가격(원)과 중량(g)으로 저장한다. kg 환산은 price×1000/weight_g, 중량 미입력이면 계산하지 않는다. `grind`, `dose`는 기기 설정 숫자이며 실제 g으로 추정하지 않는다. 현재 가격 확인일·가격 이력·원두 재고·자동 상품 수집 기능은 없다. 원두 목록과 상세는 이미지 없이 표시한다. 판매 가격은 중량과 무관하게 표시하며 기존 image_url 값은 보존한다. 세부 동작은 [커피 기능](home-cafe/coffee-features.md)을 따른다.

초기 원본 10개 브랜드·11개 원두는 [원본 요구사항](home-cafe/DESIGN.md)과 seed-data.ts에서 확인한다. 데모와 실제 DB를 혼동하지 않는다. seed는 운영 소유자 생성 뒤 필요할 때만 실행한다.

## 와인 데이터 의미

`wines`, `wine_purchases`, `wine_stock_events`, `wine_tastings`, `wine_glasses`, `wine_photos`를 사용한다. 제품 등록과 입고는 별개다. UUID로 작업하며 display_id는 표시 전용이다. `vintage_kind`의 year/non_vintage/unknown을 구분한다.

재고는 이벤트 합계이며 취소 이력을 보존한다. 최신 유효 구매(구입일, 같은 날은 생성시각) 또는 더 최근인 이관 참조일의 가격을 사용한다. 최신 구매가 공란이면 과거 가격으로 덮지 않는다. 현재 재고×최근 구입가는 추정 가치이고 실제 구매 로트 원가가 아니다. 가족 구성원별 시음이 있지만 UI에서는 사용자 평점으로 표시한다. 평점은 0~100이며 Vivino 평점이 아니다.

[상세 기능](wine-celler/cellar-features.md), [현재 AI 작업 지침](wine-celler/skill.md), [이관 보고서](wine-celler/migration-report.md)를 함께 읽는다. 이관 시 64종·62병·잔 5종이었으며 이후 작업으로 수량은 달라질 수 있다. Airtable은 현재 실시간 DB가 아니다.

## 지금 없는 기능

내장 AI 채팅, OCR/자동 라벨 판독, 웹 사진 자동 검색·매칭, 실시간 구독, 구매 로트별 원가, 예약 작업, 메일 발송, 공개 회원가입, 여러 공간을 전환하는 UI는 없다. 이런 기능을 추가할 때 실제 스키마·권한·비용·비동기 처리 요구를 먼저 정한다.

## 가계부 데이터 의미

가계부는 거래 행 대신 파일명별 최신 XLSX 원본을 Neon bytea에 저장한다. 같은 이름 업로드는 원본 교체이며 이전 버전은 보관하지 않는다. 웹 전용이며 기존 MCP에는 노출하지 않는다. 원화·음수·날짜·평균 분모·제외 규칙과 파일 접근은 [가계부 기능](cash-money/README.md)을 따른다.
