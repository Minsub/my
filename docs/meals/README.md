# 취미 · 집밥

취미 > 집밥(`/hobby/meals`)은 집에서 해먹을 요리 목록이다. 뭐 해먹을지 고를 때 본다. 재료는 메인 재료만 적는다. 웹과 MCP 양쪽에서 추가할 수 있고, MCP는 **추가·조회만** 연다. 2026-10-31 코드 기준.

## 항목

| 항목 | 규칙 |
|---|---|
| 요리 이름 | 필수, 100자. 띄어쓰기·대소문자만 다른 이름은 같은 요리로 보고 거부(`title_key`, `DUPLICATE_TITLE` 409) |
| 메인 재료 | 필수, 1~30개(각 40자). 앞뒤 공백·`#`·중복을 서버가 지운다 |
| 카테고리 | 필수. 한식·양식·중식·일식·아시안·분식·기타. `src/lib/meals.ts`의 `mealCategories` 한 곳에서 바꾼다(SQL CHECK 없음) |
| 태그 | 선택, 최대 20개(각 30자). 자유 입력 |
| 해보고 싶음 | 체크박스(`want_to_try`). 태그·카테고리와 따로 둔다 |
| 링크 | 선택, 최대 10개. http(s) 주소만(YouTube·블로그 등 무엇이든). 입력 순서 유지, 중복 제거 |
| 메모 | 선택, 2000자 |

## 화면

- 상단: 요리 수·해보고 싶음 수, "요리 추가".
- 필터: 검색(이름·재료·태그·메모, 공백으로 나눈 낱말 모두 포함), "해보고 싶음" 토글, 카테고리 칩(요리가 있는 것만, 개수), 태그 칩(많이 쓴 순, 여러 개 고르면 모두 가진 요리, 12개 넘으면 "더"). 상태는 URL `q`·`category`·`tag`(쉼표)·`want=1`.
- 목록: 최근 추가 순 카드. 이름·해보고 싶음 배지·카테고리·재료·태그·링크 수, 첫 링크 썸네일.
- 카드를 누르면 상세 시트(재료·태그·링크 미리보기 카드·메모·추가한 사람). 추가한 사람·관리자만 고치기·삭제(삭제는 시트 안에서 한 번 더 확인).
- 입력 시트: 재료·태그는 쉼표로 적고 아래에 이미 쓴 이름을 제안한다(마지막 쉼표 뒤 글자로 좁힘, 누르면 채움). 링크는 줄을 더해 여러 개.
- 코드: `src/components/meal-list.tsx`, `src/app/meals.css`, 진입 카드는 `menu-hub.tsx`의 `hobbyMenus`, 데모 데이터 `src/lib/demo-meals.ts`.

## 링크 미리보기

썸네일·제목은 저장하지 않고 화면에 보일 때 `GET /api/meals/preview?url=`(로그인 필요, 분당 90회)로 링크의 og 태그를 읽는다(`src/server/link-preview.ts`).

- YouTube는 영상 ID로 `i.ytimg.com` 썸네일을 바로 만들고, 제목은 oEmbed로 읽는다.
- 그 밖은 HTML 앞부분(최대 600KB, 5초)을 읽어 `og:title`/`og:image`/`twitter:*`/`<title>`을 쓴다. EUC-KR 등 문자셋을 따른다.
- 서버가 사용자 입력 주소로 요청하므로 매 이동(최대 4번)마다 DNS를 확인해 사설·루프백·링크로컬 주소와 80/443 외 포트를 막는다.
- 결과는 서버 메모리 6시간(최대 300개), 브라우저 하루 캐시. 사이트가 막거나 느리면 오류 없이 썸네일 없는 링크로 보인다.
- 이미지는 외부 주소를 그대로 `<img referrerPolicy="no-referrer">`로 띄운다(앱 CSP에 img-src 제한 없음).

## 저장·권한

- 표: `db/migrations/018_meal_dishes.sql`의 `meal_dishes`. 조회 `GET /api/meals`, 쓰기는 공통 `POST /api/commands`의 `meal_create`·`meal_update`·`meal_delete`(서버 `src/server/meals.ts`).
- scope: `meal:read`·`meal:write`. `meal_update`·`meal_delete`는 `webOnlyCommands`라 MCP에 나가지 않고 MCP 채널에서 거부한다.
- 수정·삭제는 version 검사(`VERSION_CONFLICT`)와 추가한 사람 또는 관리자 조건.
- 필터는 `src/lib/meals.ts`의 `filterMeals`를 웹·MCP가 같이 쓴다.

## MCP

| 도구 | 동작 |
|---|---|
| `meal_create` | 요리 추가. 도구 설명에 메인 재료만 짧은 이름으로, 먼저 `meal_list`로 기존 재료·태그 표기 확인, 링크만 받았으면 내용을 읽어 채우라는 안내가 있다 |
| `meal_list` | 검색어·카테고리·태그(쉼표=모두)·재료·해보고 싶음으로 거른 목록(기본 50개, cursor). `ingredients_in_use`·`tags_in_use`·`categories` 함께 반환 |

scope를 새로 만들었으므로 배포 후 기존 AI 연결은 다시 승인해야 집밥 도구가 보인다.
