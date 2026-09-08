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
      "선택: query, in_stock, type, country, region, grape, vintage(연도/NV), min_price/max_price(원), from/to(구입일), min_score(0~100), sort, cursor, limit. sort: added_desc, price_asc/price_desc, date_asc/date_desc, name_asc, vintage_asc, stock_desc, score_desc.",
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
  household_get_summary: {
    title: "가족 컬렉션 요약",
    description: "연결 시 허용한 도메인의 집계를 조회합니다.",
    input: "없음.",
    result:
      "coffee_beans(보관함 제외 원두 종류 수), wine_bottles(보관함 포함 전체 와인 재고 합). 조회 권한 없는 도메인은 생략합니다.",
    example: "우리 가족 원두 종류와 와인 병수를 알려줘.",
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
