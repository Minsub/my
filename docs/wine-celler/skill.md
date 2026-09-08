# MONO 와인 작업 지침

현재 DB는 Neon이며 작업 인터페이스는 MONO MCP다. 이 문서는 에이전트의 와인 업무 지침이다. 과거 Airtable MCP 지침은 [비활성 참고 자료](../archive/airtable-wine-reference.md)에 보존했다. 현재 와인 정보·재고를 Airtable에 쓰지 않는다.

## 조회·대상 식별

- `wine_list`로 이름/종류/국가/빈티지/가격/재고 등을 검색한다. next_cursor가 있으면 다음 페이지를 조회한다. 단일 100건 응답을 전체라고 가정하지 않는다.
- 표시 번호는 display_id이며 실제 변경에는 UUID id/wine_id를 사용한다. 최대 번호+1로 ID를 만들지 않는다.
- 이름·빈티지가 같아도 생산자·큐베·용량을 대조한다. 여러 후보면 대상을 확인한다. 임의로 병합하지 않는다.
- `wine_get`은 구매·시음·최근 가격·version을 반환한다. 재고 없는 와인을 조회하려면 in_stock을 true로 제한하지 않는다.

## 등록·구매

1. 입력에서 확인된 이름·종류·원산지·품종·빈티지만 사용한다. 사진 해석은 외부 AI가 수행하며 OCR API가 서버에 있다고 가정하지 않는다. 모르는 값은 비워둔다. NV와 빈티지 미상을 구분한다.
2. 기존 제품이 확인되면 그 wine_id를 사용하고, 신규면 `wine_create`로 만든다.
3. 실제 구매 수량·병당 가격·날짜·구입처를 `wine_receive_stock`으로 저장한다. 제품 생성만으로 재고가 늘지 않는다.
4. 제품 생성 뒤 입고가 실패하면 완료된 제품 생성을 반복하지 말고 입고 단계만 재시도한다. 같은 요청은 같은 UUID idempotency_key와 입력을 유지한다.

## 사진

`wine_upload_photo`에 실제 파일의 base64 데이터, wine_id, expected_version, idempotency_key를 전달한다. 링크/파일명만으로 업로드했다고 말하지 않는다. 서버가 최대 1,000px·300KB WebP 사본을 DB에 저장한다. 원본 JPEG/PNG/WebP는 약 2MB 이하이며 HEIC는 지원하지 않는다.

파일 접근이 불가능하면 `wine_photo_upload_link`로 직접 업로드할 웹 화면을 안내한다. 도구 반환 결과로 저장 성공을 확인한다. 웹 검색 링크는 Vivino로 통일하며 자동 이미지 매칭은 없다. 제품명·빈티지가 일치하지 않는 이미지를 확정하지 않는다.

## 소비·시음·취소

- `wine_consume`: 실제 마신 수량만 차감한다. 선택적으로 tasting을 함께 남긴다. 부족한 수량은 저장할 수 없다.
- `wine_log_tasting`: 재고 변화 없이 본인의 시음 기록을 추가한다. 점수는 0~100, 재구매는 true/false/null로 구분한다.
- `wine_reverse_event`: 잘못된 입고/소비를 event_id와 사유로 취소한다. 초기 이관 재고와 이미 취소한 기록은 취소하지 않는다.
- version 충돌은 최신 항목을 다시 조회해 적용한다. 권한 오류를 우회하거나 DB 재고를 직접 변경하지 않는다.

## 추천

`wine_get_pairing_context`의 보유 와인·잔·시음 기록을 바탕으로 후보를 제안한다. 필요한 모든 페이지를 읽는다. 음식/상황에 맞는 최대 3개를 골라 이유·보유 잔·일반적인 제공 온도 등을 설명하되 저장된 사실과 AI 제안을 구분한다. 추천만으로 재고를 차감하지 않는다.

정확한 도구별 입력·출력은 설정의 MCP 안내와 `src/lib/mcp-guide.ts`, `src/lib/contracts.ts`, `src/server/mcp.ts`를 확인한다. 이관 내역은 [migration-report.md](migration-report.md), 가격/차트 규칙은 [cellar-features.md](cellar-features.md)를 따른다.
