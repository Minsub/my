# 단일 HTML로 페이지 추가하기

React 컴포넌트로 다시 작성하지 않고 HTML 한 파일을 앱 안에서 실행하는 방식이다. 첫 구현은 `/cash/old`다. 현재 **저장소에 HTML을 추가/교체하고 배포**하는 방식이며, 웹에서 임의 HTML을 업로드하는 관리 화면은 아니다. HTML 안의 CSS/JS를 독립적으로 작성할 수 있다. 앱 메뉴·인증·데이터 연결은 한 번 등록한다.

## 현재 연결

- 원본: `docs/cash-money/cash-money.html`. 파일을 복제해 다른 버전을 관리하지 않는다.
- 등록/어댑터: `src/server/html-pages.ts`의 `pages` 목록. 요청 문자열을 파일 경로로 사용하지 않는다.
- 보호된 소스 조회: `/api/html-pages/cash-old`. 웹 세션을 검사하고 HTML을 JSON으로 private/no-store 반환한다.
- 공통 표시: `src/components/single-html-page.tsx`의 `SingleHtmlPage`.
- 앱 진입: `cash-old.tsx`, catch-all 허용 경로 `/cash/old`, AppShell 분기. 가계부의 old 링크로 이동하므로 모바일 주 메뉴를 늘리지 않는다.
- Vercel 배포 파일 포함: `next.config.ts`의 `outputFileTracingIncludes`. 원본 HTML, SheetJS 및 Chart.js 런타임을 포함한다.

## 엑셀 연결 흐름

1. 부모 앱이 소스와 `/api/cash/files` 목록을 읽는다.
2. 각 파일의 기존 인증 API `/api/cash/files?id=...`에서 원본을 한 번씩 읽는다. 한 개의 거대 응답으로 묶지 않아 서버리스 응답 한도를 피한다.
3. iframe의 `mono:cash-ready`를 받으면 지정한 iframe에만 이름+ArrayBuffer를 전달한다. source와 opaque origin(`null`)을 확인한다. 전역 메시지를 API 프록시로 전달하지 않는다.
4. 원본은 메모리상의 디렉터리 객체를 기존 `loadFromHandle()`에 전달한다. 분석 함수·차트·HTML 템플릿은 그대로다. 폴더 선택 버튼만 숨기고 초기화 함수를 대체한다.
5. 원본 내부 새로고침은 이미 로드한 바이트를 다시 분석한다. 서버의 새 파일은 브라우저 페이지 새로고침/다시 진입해야 반영된다. 필터 조작마다 파일을 다시 받지 않는다.

파일은 부모와 iframe의 메모리에만 존재한다. localStorage, IndexedDB, 공개 URL에 저장하지 않는다. SheetJS 0.20.3과 Chart.js 4.4.6을 배포 패키지에서 인라인으로 공급하므로 CDN에 의존하지 않는다. 원본의 계산 의미 차이는 [기능 대조](cash-money/feature-audit.md)를 확인한다.

## 다른 HTML을 등록하는 절차

1. UTF-8 `<html><head>…</head><body>…</body></html>` 문서를 저장소에 추가한다. CSS/JS는 파일 내에 넣는다. 실제 개인정보를 HTML에 하드코딩하지 않는다.
2. `html-pages.ts`의 목록에 `{ load: () => readFile(path.join(process.cwd(), "docs/도구/tool.html"), "utf8"), adapter: "none" }`를 등록한다. 파일 경로는 문자열 리터럴로 고정한다. 동적인 저장소 루트 경로는 빌드 시 비공개 파일까지 추적할 수 있으므로 사용하지 않는다. `none`은 외부 데이터가 필요 없는 단일 HTML에 적합하다.
3. 새 화면에서 `<SingleHtmlPage pageId="등록키" title="도구 이름" />`를 사용한다. pageId가 변경되면 별도 인스턴스로 다시 로드한다.
4. `development.md`의 catch-all·AppShell·메뉴·데모 절차에 따라 경로를 등록한다. 데모에서 인증 API를 호출하지 않는다.
5. Vercel tracing 목록에 새 HTML을 추가한다. 빌드 `.nft.json`에 포함됐는지 확인한다.
6. 데이터가 필요하면 서버의 기존 업무 서비스와 별도의 명시적 어댑터를 작성한다. `dataSource="cash"`는 가계부 엑셀 전용이다. 다른 HTML에 가계부 파일을 자동 전달하지 않는다.

원본을 바꿀 때 화면과 분석 코드는 HTML 한 파일에서 수정하면 된다. 데이터 계약, 외부 라이브러리, init 규칙을 바꾸면 어댑터도 함께 수정한다. 현재 cash 어댑터는 `// ===== Init =====` 마커와 `state`, `loadFromHandle()`을 사용하며 마커가 사라지면 오류로 멈춘다.

## 격리와 제한

iframe은 `sandbox="allow-scripts allow-downloads"`이며 `allow-same-origin`이 없다. HTML은 앱 쿠키·DOM·저장소·API에 직접 접근할 수 없다. 외부 fetch·이미지·스크립트 로딩과 폼 전송·팝업/최상위 이동을 제한하고 인라인 스타일/스크립트, data/blob 이미지, 다운로드만 사용한다. 공통 앱의 frame 보안 헤더를 완화하지 않는다.

리뷰된 저장소 HTML만 실행하는 전제다. 이 격리는 악의적인 HTML을 안전하게 업로드·실행하는 일반 서비스의 보장으로 사용하지 않는다.

따라서 외부 CDN, 외부 이미지, 직접 `fetch()`에 의존하는 HTML은 그대로는 작동하지 않는다. 필요한 라이브러리는 승인된 서버 어댑터에서 파일에 포함하고 업무 데이터는 제한된 메시지 계약으로 전달한다. 링크의 임의 페이지를 iframe에 로드하거나 HTML 소스 안에 인증 토큰을 넣는 방식으로 해결하지 않는다.

새 모듈을 앱과 깊게 통합하거나 저장·라우팅·검색 접근성을 공유할 때는 React 페이지가 적합하다. 독립 계산기·보고서·기존 단일 페이지 재사용에는 이 방식이 적합하다.
