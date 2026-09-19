import type { Operation } from "./contracts";
type Entry = {
  title: string;
  description: string;
  input: string;
  result: string;
  example: string;
};
export const commandGuide = {
  coffee_create_brand: {
    title: "브랜드 등록",
    description: "커피 브랜드와 공식 홈페이지를 등록합니다.",
    input: "name(이름). 선택: url(HTTPS), description(소개).",
    result: "등록된 브랜드 ID와 버전.",
    example: "이 로스터리를 새 브랜드로 등록해줘.",
  },
  coffee_update_brand: {
    title: "브랜드 수정",
    description: "등록된 브랜드의 이름·홈페이지·소개를 수정합니다.",
    input:
      "id, expected_version, name. url과 description도 기존 값을 함께 전달하세요.",
    result: "수정된 브랜드와 새 버전.",
    example: "이 브랜드의 홈페이지를 바꿔줘.",
  },
  coffee_create_bean: {
    title: "원두 등록",
    description:
      "브랜드에 원두 상품을 추가합니다. 확인하지 못한 가격·배전은 비워둡니다.",
    input:
      "brand_id, name. 선택: product_url, image_url, roast, flavor, price(원), weight_g(g).",
    result:
      "등록된 원두 ID와 버전. 원두 image_url은 외부 HTTPS 링크이며 와인 사진 업로드와 저장 방식이 다릅니다.",
    example: "이 브랜드에 200g, 18,000원짜리 원두를 등록해줘.",
  },
  coffee_update_bean: {
    title: "원두 수정",
    description: "원두의 상품 정보와 가격 등을 수정합니다.",
    input: "id, expected_version, brand_id, name과 유지할 기존 상품 정보 전체.",
    result: "수정된 원두와 새 버전.",
    example: "이 원두 가격을 19,000원으로 바꿔줘.",
  },
  coffee_save_preference: {
    title: "내 원두 취향 기록",
    description:
      "연결한 본인 계정의 구매 예정·경험·추천 여부와 메모를 저장합니다.",
    input:
      "bean_id, expected_version(첫 기록은 null), status(구매예정/먹어봄/null), recommendation(추천/보통/비추천/null). 선택: note.",
    result: "본인의 취향 기록과 버전.",
    example: "이 원두는 먹어봤고 추천해. 산미가 좋았다고 기록해줘.",
  },
  coffee_create_machine: {
    title: "커피 머신 등록",
    description: "추출 설정에 사용할 가족의 머신을 추가합니다.",
    input: "name(머신 이름).",
    result: "등록된 머신 ID.",
    example: "우리 집 머신을 등록해줘.",
  },
  coffee_log_brew_setting: {
    title: "추출 설정 기록",
    description:
      "원두와 머신에 대한 본인의 분쇄도·용량 설정 숫자를 기록합니다. 용량 설정을 임의로 g으로 해석하지 않습니다.",
    input: "bean_id, machine_id, grind(분쇄도), dose(용량 설정). 선택: note.",
    result: "추출 설정 기록.",
    example: "이 원두를 우리 머신에서 분쇄도 4, 용량 설정 6으로 기록해줘.",
  },
  wine_create: {
    title: "와인 등록",
    description:
      "와인의 제품 정보를 등록합니다. 재고와 사진은 이어서 별도 도구로 등록합니다.",
    input:
      "name, type(레드/화이트/로제/스파클링/디저트/주정강화). 선택: english_name, producer, country, region, grapes, vintage_kind(year/non_vintage/unknown), vintage, volume_ml.",
    result: "와인 ID와 version. 새 와인의 재고는 0병.",
    example: "이 와인을 2020년 빈티지의 프랑스 레드로 등록해줘.",
  },
  wine_update: {
    title: "와인 정보 수정",
    description:
      "이름·생산자·원산지·품종·빈티지 등 제품 정보를 수정합니다. 재고는 바꾸지 않습니다.",
    input: "id, expected_version, name, type과 유지할 기존 와인 정보 전체.",
    result: "수정된 와인과 새 버전.",
    example: "이 와인의 생산자 정보를 수정해줘.",
  },
  wine_receive_stock: {
    title: "와인 구매·입고",
    description:
      "구입 수량만큼 재고를 늘리고 병당 구입가·구입일·구입처를 기록합니다.",
    input:
      "wine_id, quantity(1~1,000병). 선택: unit_price(병당 원), purchased_on(YYYY-MM-DD, 기본 오늘), store.",
    result: "입고 이벤트. 재고가 증가하고 구매 내역이 생성됩니다.",
    example: "이 와인 2병을 9월 8일에 병당 35,000원으로 샀어.",
  },
  wine_consume: {
    title: "와인 소비",
    description:
      "보유 수량에서 마신 병수를 차감합니다. 재고가 부족하면 거부하며, 시음을 함께 기록할 수 있습니다.",
    input:
      "wine_id. 선택: quantity(기본 1병), occurred_on(기본 오늘), tasting{score,note,repurchase,tasted_on}.",
    result: "소비 이벤트와 감소한 재고. 선택한 시음 기록.",
    example: "이 와인 한 병 마셨어. 91점이고 다시 사고 싶다고 기록해줘.",
  },
  wine_log_tasting: {
    title: "와인 시음 기록",
    description:
      "재고를 바꾸지 않고 본인의 점수·시음 노트·재구매 의사를 남깁니다.",
    input:
      "wine_id. 선택: score(0~100/null), note, repurchase(true/false/null), tasted_on(기본 오늘).",
    result: "본인 계정의 시음 기록.",
    example: "재고 차감 없이 이 와인 시음 점수를 88점으로 남겨줘.",
  },
  wine_reverse_event: {
    title: "입고·소비 취소",
    description:
      "잘못된 기록을 삭제하는 대신 반대 재고 기록을 남깁니다. 초기 이관 재고·이미 취소한 기록은 취소할 수 없습니다.",
    input: "event_id(취소할 이벤트 ID), reason(사유).",
    result:
      "취소 이벤트. 재고를 복원하며 원래 기록은 남습니다. 입고 취소로 재고가 음수가 되면 거부합니다.",
    example: "방금 잘못 기록한 소비를 취소해줘.",
  },
  wine_save_glass: {
    title: "와인잔 등록·수정",
    description: "가족이 보유한 잔의 이름·브랜드·종류·메모를 관리합니다.",
    input:
      "name, type. 선택: brand, note. 수정할 때 id와 expected_version도 전달합니다.",
    result: "저장된 와인잔과 버전.",
    example: "리델 피노 누아 잔을 등록해줘.",
  },
  asset_save_owner: {
    title: "자산 소유자 등록·수정",
    description:
      "자산현황에 표시할 소유자를 관리합니다. 로그인 계정이 없는 구성원도 등록할 수 있습니다.",
    input:
      "name(표시 이름). 선택: id·expected_version(수정), link_to_me(내 계정과 연결), sort_order, active.",
    result: "저장된 소유자와 버전.",
    example: "자산 소유자에 장미를 추가해줘.",
  },
  asset_record_snapshot: {
    title: "자산 현황 기록",
    description:
      "한 사람의 그 날짜 자산 현황 전체를 원본 종목 단위로 저장합니다. 같은 사람·같은 날짜로 저장하면 그 날짜를 통째로 교체합니다. 그룹 합계는 항목에서 자동으로 계산합니다.",
    input:
      "owner_id 또는 owner_name, items[{group_key, name, broker, amount, quantity, profit, profit_rate}] (최대 300개). 선택: as_of(기본 오늘), expected_version(덮어쓸 때), rules_version, note. 금액은 원화 환산 정수이고 수익률은 1.94%를 0.0194로 보냅니다.",
    result:
      "스냅샷 ID·버전·총액·항목 수와 그룹별 교체 전후 값(changes). replaced가 true면 기존 기록을 덮어쓴 것입니다.",
    example:
      "증권사 화면의 자산 목록을 그룹으로 나눠서 오늘 날짜로 내 자산현황을 기록해줘.",
  },
  asset_delete_snapshot: {
    title: "자산 기록 삭제",
    description: "잘못된 날짜로 저장한 자산 기록을 지웁니다.",
    input: "id(스냅샷 UUID).",
    result: "삭제 여부와 대상 날짜.",
    example: "어제 잘못 등록한 자산 기록을 지워줘.",
  },
} satisfies Record<
  Exclude<Operation, `family_${string}` | "archive_item">,
  Entry
>;
export const readGuide: Record<string, Entry> = {
  coffee_list_brands: {
    title: "브랜드 목록",
    description: "가족의 커피 브랜드를 이름으로 검색합니다.",
    input: "선택: query, cursor, limit.",
    result: "items(브랜드 목록), total, next_cursor.",
    example: "등록된 로스터리를 보여줘.",
  },
  coffee_list_beans: {
    title: "원두 목록",
    description: "보관 처리하지 않은 원두 목록과 상품 정보를 조회합니다.",
    input: "선택: query(원두 이름), cursor, limit.",
    result: "원두 목록·가격·상세 화면 링크와 다음 페이지 위치.",
    example: "우리 집 원두 목록을 보여줘.",
  },
  coffee_list_machines: {
    title: "머신 목록",
    description: "추출 기록에 사용할 등록된 머신을 찾습니다.",
    input: "선택: query, cursor, limit.",
    result: "머신 목록과 ID.",
    example: "등록된 커피 머신이 뭐가 있어?",
  },
  coffee_get_bean: {
    title: "원두 상세·가족 취향",
    description: "원두 상품 정보와 가족의 취향·추출 설정을 함께 조회합니다.",
    input: "id(원두 UUID).",
    result:
      "원두 상세, preferences(가족 취향), settings(추출 설정), 웹 화면 링크.",
    example: "이 원두에 대한 가족 평가와 머신 설정을 알려줘.",
  },
  wine_list: {
    title: "와인 검색·정렬",
    description:
      "와인과 실제 구입가·구입일·재고·가족 평균 점수를 조회합니다. 보관함은 제외하며 재고가 0인 와인도 기본으로 포함합니다.",
    input:
      "선택: query, in_stock, type, country, region, grape(블렌드는 구성 품종 하나만 맞아도 포함), vintage(연도/NV), min_price/max_price(원), from/to(구입일), min_score(0~100), sort, cursor, limit. sort: added_desc, price_asc/price_desc, date_asc/date_desc, name_asc, vintage_asc, stock_desc, score_desc.",
    result:
      "와인 목록, price(최근 구입가), purchased_on, score, has_photo, total, next_cursor와 상세 링크. 가격·평점은 Vivino 시세·평점이 아닙니다.",
    example: "재고 있는 프랑스 와인 중 5만원 이하를 가격 낮은순으로 보여줘.",
  },
  wine_get: {
    title: "와인 상세·구매·시음",
    description: "와인 한 종류의 제품 정보와 구매·가족 시음 내역을 조회합니다.",
    input: "id(와인 UUID).",
    result:
      "와인 정보·현재 재고·최근 구입가·version·has_photo, purchases, tastings, 웹 화면 링크. 사진 파일 자체는 포함하지 않습니다.",
    example: "이 와인을 언제 얼마에 샀고 가족들이 어떻게 평가했어?",
  },
  wine_list_glasses: {
    title: "와인잔 목록",
    description: "보유한 잔의 이름·브랜드·종류·메모를 조회합니다.",
    input: "선택: query(이름), type(잔 종류), cursor, limit.",
    result: "잔 목록과 다음 페이지 위치.",
    example: "우리 집에 어떤 와인잔이 있어?",
  },
  wine_get_pairing_context: {
    title: "음식·와인 추천 자료",
    description:
      "현재 보유 와인과 잔·시음 기록을 AI에게 제공합니다. 음식과의 조합은 AI가 이 자료를 바탕으로 설명합니다.",
    input:
      "선택: type(와인 종류), cursor, limit. 항상 재고 있는 와인만 반환합니다.",
    result:
      "wines, glasses, tastings, as_of(조회 시각), next_cursor. 추천만으로 재고가 차감되지는 않습니다.",
    example: "오늘 연어 요리에 맞는 보유 와인과 잔을 추천해줘.",
  },
  asset_get_classification_rules: {
    title: "자산 분류 기준 조회",
    description:
      "원본 자산 목록을 자산 그룹으로 나누는 기준을 반환합니다. 그룹 정의·우선순위 규칙·금액 단위·저장 규칙이 함께 들어 있습니다.",
    input: "없음.",
    result:
      "rules_version, groups(그룹과 통화·위험 구분), rules(priority 오름차순 규칙), instructions, write_contract.",
    example: "자산을 어떤 기준으로 묶어야 하는지 알려줘.",
  },
  asset_classify_rows: {
    title: "자산 행 분류 미리보기",
    description:
      "원본 자산 행을 규칙으로만 분류합니다. 규칙은 발행어음·RP·채권·예적금·금·현금과 국내 ETF를 확정하고, 개별 종목은 판단하지 않습니다.",
    input: "rows[{name, broker, amount}] (최대 300행).",
    result:
      "items(행별 group_key와 needs_review), needs_review 건수, lines(그룹별 합계). needs_review 행은 상장 거래소를 기준으로 직접 판단합니다.",
    example: "이 자산 목록을 그룹별로 나눠줘.",
  },
  asset_list_owners: {
    title: "자산 소유자 목록",
    description: "등록된 소유자와 각자의 최신 등록일·총액을 조회합니다.",
    input: "없음.",
    result:
      "owners(id, name, active, linked_to_me, latest)와 자산현황 화면 링크.",
    example: "자산 소유자가 누가 있어?",
  },
  asset_get_summary: {
    title: "자산 현황 요약",
    description:
      "최신 기간의 자산 구성과 직전 기간 대비 증감을 조회합니다. 자산그룹·상위그룹·통화·위험 기준으로 볼 수 있습니다.",
    input:
      "선택: owner_id(생략하면 전체 합계), axis(group/parent/currency/risk), period(month/year).",
    result:
      "summary(총액·증감·묶음별 금액과 비중), cagr(연평균 증가율), currency_mix(원화·달러 금액), owners(소유자별 총액), unclassified.",
    example: "우리 자산 위험자산 비중이 지난달보다 얼마나 늘었어?",
  },
  asset_list_snapshots: {
    title: "자산 시계열 조회",
    description:
      "기간별 자산 추이를 조회합니다. 한 기간에 기록이 여러 건이면 그 기간의 최신 기록을 쓰고, 기록이 없는 소유자는 직전 기록을 이어 씁니다.",
    input: "선택: owner_id, axis, period(month/year), from, to.",
    result: "points(기간별 총액·묶음별 금액·carried·as_of).",
    example: "올해 자산 추이를 상위그룹 기준으로 보여줘.",
  },
  asset_list_items: {
    title: "묶음 상세 종목 조회",
    description:
      "어떤 기간의 한 묶음에 실제로 어떤 종목이 들어 있는지 조회합니다.",
    input:
      "at(월이면 YYYY-MM, 연이면 YYYY). 선택: owner_id, axis, period, bucket(생략하면 그 기간 전체).",
    result: "items(이름·증권사·금액·수량·수익금·수익률·소유자·기준일), total.",
    example: "지난달 해외 주식에 뭐가 들어 있었어?",
  },
  asset_list_records: {
    title: "등록 이력과 원본 항목",
    description:
      "언제 무엇을 등록했는지와 한 등록 건의 원본 항목 전체를 조회합니다.",
    input: "선택: snapshot(생략하면 가장 최근 등록 건).",
    result: "snapshots(등록 이력), selected(그 등록 건의 원본 항목 전체).",
    example: "마지막으로 등록한 자산 원본을 그대로 보여줘.",
  },
  household_get_summary: {
    title: "가족 컬렉션 요약",
    description: "연결 시 허용한 도메인의 집계를 조회합니다.",
    input: "없음.",
    result:
      "coffee_beans(보관함 제외 원두 종류 수), wine_bottles(보관함 포함 전체 와인 재고 합), asset_total·asset_as_of(최신 자산 총액과 기준일). 조회 권한 없는 도메인은 생략합니다.",
    example: "우리 원두 종류와 와인 병수, 자산 총액을 알려줘.",
  },
};
export const photoGuide: Record<string, Entry> = {
  wine_upload_photo: {
    title: "와인 사진 업로드·교체",
    description:
      "실제 이미지 데이터를 전달하면 서버가 압축된 사본을 우리 DB에 저장합니다. 외부 사진 URL을 저장하는 도구가 아닙니다.",
    input:
      "wine_id, expected_version, idempotency_key(UUID), image_base64(실제 파일을 base64로 인코딩한 문자열, data URL 접두사 제외). JPEG/PNG/WebP, 원본 최대 약 2MB.",
    result:
      "id, 새 version, has_photo:true. 최대 1,000px·300KB WebP로 저장하고 위치정보 등 메타데이터를 제거합니다.",
    example:
      "첨부한 사진 파일을 읽을 수 있으면 이 와인의 대표 사진으로 올려줘. 파일을 전달할 수 없으면 업로드 링크를 줘.",
  },
  wine_photo_upload_link: {
    title: "직접 사진을 올릴 링크",
    description:
      "AI가 첨부파일을 직접 전달하지 못할 때 가족 로그인 업로드 화면을 안내합니다. 링크 생성만으로 사진이 저장되지는 않습니다.",
    input: "wine_id.",
    result:
      "와인 상세의 사진 업로드 위치를 가리키는 URL. 사용자가 가족 계정으로 로그인하고 파일을 선택해야 합니다. 도구는 wine:write 연결에 표시됩니다.",
    example: "이 와인의 사진을 내가 직접 올릴 수 있게 링크를 줘.",
  },
};
