# 취미 · 베이킹

취미 > 베이킹(`/hobby/baking`) 레시피 기록. DB·API·MCP 없이 저장소의 정적 데이터로 그린다. 레시피를 추가·수정하면 커밋·배포로 반영된다.

## 화면

- `/hobby/baking` — 목록. 이름·분류·출처·재료 이름 검색(공백으로 나눈 낱말 모두 포함), 분류 칩(레시피가 있는 분류만), 카드에 분류·구성·오븐 온도·총 무게. 정렬은 추가일 최근 순, 같은 날이면 이름 순. 검색어·분류는 URL `q`·`category`.
- `/hobby/baking/{id}` — 상세. 배율 ×0.5~×2, 재료 계량 체크(화면 메모리, 새로고침하면 지워짐), 구성이 둘 이상이면 맨 위에 전체 재료 합계(같은 이름·단위는 합치고 구성별 색으로 나눔), 오븐 타임라인, 구성별 재료("이름 ····· 양" 계량 목록)·공정, 손글씨 메모 표시. 서로 다른 재료끼리는 비교할 의미가 없어 재료 양을 막대로 그리지 않는다. 상자(전체 재료·오븐·구성·메모)마다 접고 펴며, 접은 상태는 브라우저 localStorage `mono.baking.folds`에 레시피별로 남는다. 없는 id는 404.
- 코드: `src/components/baking-recipes.tsx`(목록), `baking-recipe.tsx`(상세), `src/app/baking.css`, 진입 카드는 `menu-hub.tsx`의 `hobbyMenus`.

## 파일 구조

```
src/lib/baking/
  types.ts           레시피 형식과 분류 목록(bakingCategories)
  index.ts           등록 목록·id 검사·합계·검색·전체 재료 합치기
  recipes/{id}.ts    레시피 하나 = 파일 하나
docs/baking/recipes/{id}.md   사진·영상에서 옮긴 원문 기록
```

## 레시피 추가 절차

1. 원본(사진·캡처)을 `docs/baking/recipes/{id}.md`로 옮긴다. 표에 재료·양·메모, 그 아래 만드는 법. 손글씨는 ✍️, 읽기 어려운 글자는 `(?)`.
2. `src/lib/baking/recipes/{id}.ts`를 만든다. 기존 파일 하나를 복사해 고치는 것이 가장 빠르다.
   - `id`: 영문 소문자·숫자·하이픈. URL과 접기 기억의 키라서 한번 정하면 바꾸지 않는다.
   - `category`: `types.ts`의 `bakingCategories` 중 하나. 새 분류가 필요하면 그 배열에 추가한다(칩 순서).
   - `addedAt`: 추가한 날 `YYYY-MM-DD`(목록 정렬).
   - `parts`: 반죽·커드·크림처럼 따로 계량하는 덩어리. 구성이 둘 이상이면 전체 재료 상자가 자동으로 생긴다.
   - 재료 `qty`+`unit`(g·ml·개)은 배율에 맞춰 곱한다. g가 아닌 양은 `grams`에 g 환산값을 넣어야 무게 합계에 들어간다. 숫자가 아닌 양(한 꼬집)은 `text`.
   - 문자열 표기: `{{메모}}` 손글씨, `~~값~~` 지운 값, `(?)` 읽기 어려운 글자.
   - `ovens`: 오븐에 넣는 단위마다 한 줄(온도·분, 범위면 `max`). 공정의 `heat`는 해당 단계 옆 칩.
3. `src/lib/baking/index.ts`의 `registered` 배열에 import 한 줄과 항목을 넣는다. id가 형식에 맞지 않거나 겹치면 모듈을 읽을 때 오류로 멈춘다.
4. `npm run lint`, `npm run typecheck` 후 `/demo?view=/hobby/baking/{id}`에서 모바일·PC 화면을 확인한다.

같은 재료는 이름이 정확히 같아야 전체 재료에서 합쳐진다(예: `설탕`과 `흑설탕`은 따로). 레시피를 고칠 때는 Markdown과 ts를 함께 고친다.

## 레시피

| id | 이름 | 분류 | 출처 |
| --- | --- | --- | --- |
| `financier` | [휘낭시에](recipes/financier.md) | 구움과자 | YouTube 영상 설명란 |
| `lemon-milk-cake` | [레몬우유케이크](recipes/lemon-milk-cake.md) | 케이크 | Merrybonbon Baking Class + 손글씨 메모 |
| `walnut-carrot-cake` | [호두당근케이크](recipes/walnut-carrot-cake.md) | 케이크 | Merrybonbon Baking Class + 손글씨 메모 |

원본 사진은 저장소에 넣지 않는다.
