# 취미 · 베이킹

베이킹 레시피 기록. 앱 페이지(취미 > 베이킹)를 만들기 전 단계로, 레시피 원본을 Markdown으로 옮기고 HTML 한 파일로 시각화했다.

## 파일

- [recipes.html](recipes.html): 레시피 보기. 외부 파일·CDN 없이 HTML 한 파일로 동작한다(브라우저에서 바로 열기). 레시피 전환, 배율(×0.5~×2) 환산, 계량 체크, 구성이 둘 이상인 케이크의 전체 재료 합계(같은 이름·단위는 합치고 구성별 색으로 나눔), 오븐 타임라인, 구성별 재료 비중 막대, 손글씨 메모 구분. 상자(전체 재료·오븐·구성·메모)마다 머리를 눌러 접고 펴며, 배율 줄의 `모두 접기/펼치기`로 한 번에 바꾼다. 접은 상태는 브라우저에서 직접 열 때만 localStorage(`baking_folds_v1`)에 남고, 앱 iframe 안에서는 화면에만 유지된다.
- [recipes/financier.md](recipes/financier.md): 휘낭시에 — YouTube 영상 설명란.
- [recipes/lemon-milk-cake.md](recipes/lemon-milk-cake.md): 레몬우유케이크 — Merrybonbon Baking Class 자료 + 손글씨 메모.
- [recipes/walnut-carrot-cake.md](recipes/walnut-carrot-cake.md): 호두당근케이크 — Merrybonbon Baking Class 자료 + 손글씨 메모.

## 기록 규칙

- Markdown이 원본이다. HTML 안의 `recipes` 데이터는 Markdown을 옮긴 것이므로 레시피를 고치면 둘 다 고친다.
- 무게 단위는 g. 개수·꼬집처럼 무게가 아닌 양은 그대로 적는다.
- 인쇄본 위 손글씨 메모는 ✍️로 구분하고, 사진으로 읽기 어려운 글자는 `(?)`를 붙인다.
- 원본 사진은 저장소에 넣지 않는다.

## 다음 단계 후보

- `src/html/`로 옮겨 단일 HTML 페이지(`/etc/html/baking`)로 등록 — [단일 HTML 페이지 추가](../single-html-pages.md).
- 레시피를 계속 추가·수정할 거라면 React 페이지 + DB 저장(취미 메뉴)으로 전환.
