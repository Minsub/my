import type { Snapshot, Wine } from "./types";
export const champagne = (w: Wine) =>
  w.type === "스파클링" &&
  /champagne|샹파뉴|샴페인/i.test(w.region) &&
  /프랑스|france/i.test(w.country);
export function wineFacts(
  w: Wine,
  s: Pick<Snapshot, "events" | "purchases" | "tastings">,
) {
  const reversed = new Set(s.events.map((e) => e.reverses_id).filter(Boolean));
  const purchases = s.purchases
    .filter(
      (p) =>
        p.wine_id === w.id &&
        s.events.some(
          (e) =>
            e.purchase_id === p.id &&
            e.kind === "receive" &&
            !reversed.has(e.id),
        ),
    )
    .sort(
      (a, b) =>
        b.purchased_on.localeCompare(a.purchased_on) ||
        (
          s.events.find((e) => e.purchase_id === b.id)?.created_at ?? ""
        ).localeCompare(
          s.events.find((e) => e.purchase_id === a.id)?.created_at ?? "",
        ) ||
        b.id.localeCompare(a.id),
    );
  const candidate = purchases[0];
  const latest =
    candidate &&
    (!w.reference_purchased_on ||
      candidate.purchased_on >= w.reference_purchased_on)
      ? candidate
      : undefined;
  const scores = s.tastings
    .filter(
      (t) =>
        t.wine_id === w.id &&
        t.score !== null &&
        (!t.event_id || !reversed.has(t.event_id)),
    )
    .map((t) => t.score!);
  return {
    ...w,
    price: latest ? latest.unit_price : (w.reference_price ?? null),
    // 표시 가격을 고칠 때의 대상. null이면 이관 참고 가격이다.
    purchase_id: latest ? latest.id : null,
    purchased_on: latest
      ? latest.purchased_on
      : (w.reference_purchased_on ?? null),
    price_source: latest
      ? "purchase"
      : w.reference_price != null
        ? "import"
        : null,
    score: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
  };
}
export type CellarWine = ReturnType<typeof wineFacts>;
export const grapeList = (grapes: string) =>
  grapes
    .split(/[,/·]/)
    .map((g) => g.trim())
    .filter(Boolean);
export type WineFilters = Partial<
  Record<
    | "q"
    | "type"
    | "country"
    | "region"
    | "grape"
    | "vintage"
    | "band"
    | "min_price"
    | "max_price"
    | "from"
    | "to"
    | "min_score"
    | "sort"
    | "stock"
    | "archived"
    | "view",
    string
  >
>;
// 종류·국가·지역·품종·빈티지·가격 구간은 쉼표로 여러 값을 담는다. 같은 항목 안에서는 하나라도 맞으면 포함하고,
// 항목끼리는 모두 맞아야 한다. 값 자체에는 쉼표가 들어가지 않는다(품종도 grapeList가 쉼표로 나눈 이름이다).
export type MultiFilterKey =
  "type" | "country" | "region" | "grape" | "vintage" | "band";
export const filterValues = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const typeMatches = (w: Wine, type: string) =>
  type === "샴페인"
    ? champagne(w)
    : type === "기타 스파클링"
      ? w.type === "스파클링" && !champagne(w)
      : w.type === type;
export const vintageValue = (w: Wine) =>
  w.vintage_kind === "non_vintage" ? "NV" : w.vintage ? String(w.vintage) : "";
const inBand = (price: number, b: (typeof priceBands)[number]) =>
  (!b.min || price >= Number(b.min)) && (!b.max || price <= Number(b.max));
export function filterWines(rows: CellarWine[], f: WineFilters) {
  const types = filterValues(f.type),
    countries = filterValues(f.country),
    regions = filterValues(f.region),
    grapes = filterValues(f.grape).map((g) => g.toLowerCase()),
    vintages = filterValues(f.vintage),
    bands = priceBands.filter((b) => filterValues(f.band).includes(b.key));
  const result = rows.filter(
    (w) =>
      w.archived === (f.archived === "true") &&
      (f.stock === "all" || w.stock > 0) &&
      (!f.q ||
        [w.name, w.english_name, w.producer, w.grapes, w.region]
          .join(" ")
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!types.length || types.some((t) => typeMatches(w, t))) &&
      (!countries.length || countries.includes(w.country)) &&
      (!regions.length || regions.includes(w.region)) &&
      (!grapes.length ||
        grapeList(w.grapes).some((g) =>
          grapes.some((x) => g.toLowerCase().includes(x)),
        )) &&
      (!vintages.length || vintages.includes(vintageValue(w))) &&
      (!bands.length ||
        (w.price !== null && bands.some((b) => inBand(w.price!, b)))) &&
      (!f.min_price || (w.price !== null && w.price >= Number(f.min_price))) &&
      (!f.max_price || (w.price !== null && w.price <= Number(f.max_price))) &&
      (!f.from || (w.purchased_on !== null && w.purchased_on >= f.from)) &&
      (!f.to || (w.purchased_on !== null && w.purchased_on <= f.to)) &&
      (!f.min_score || (w.score !== null && w.score >= Number(f.min_score))),
  );
  const [key, direction] = (f.sort || "added_desc").split("_");
  const value = (w: CellarWine): string | number | null =>
    key === "price"
      ? w.price
      : key === "date"
        ? w.purchased_on
        : key === "name"
          ? w.name
          : key === "vintage"
            ? w.vintage
            : key === "stock"
              ? w.stock
              : key === "score"
                ? w.score
                : w.display_id;
  return result.sort((a, b) => {
    const x = value(a),
      y = value(b);
    if (x == null) return y == null ? a.id.localeCompare(b.id) : 1;
    if (y == null) return -1;
    const cmp =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "ko");
    return (direction === "asc" ? cmp : -cmp) || a.id.localeCompare(b.id);
  });
}
// 가격 구간. 필터의 최소·최대가 모두 포함(이상·이하)이라 경계 값이 두 칸에 겹치지 않게 1원 아래로 끊는다.
// 셀러의 가격 칩과 공유 페이지의 가격대 표시가 같은 구간을 쓴다.
export const priceBands = [
  { key: "u3", label: "3만 미만", min: "", max: "29999" },
  { key: "3-5", label: "3–5만", min: "30000", max: "49999" },
  { key: "5-10", label: "5–10만", min: "50000", max: "99999" },
  { key: "10u", label: "10만 이상", min: "100000", max: "" },
];
export const priceBandLabel = (price: number) =>
  priceBands.find((b) => inBand(price, b))!.label;
export const wineTypeColor: Record<string, string> = {
  레드: "#8c2f45",
  화이트: "#d6b85a",
  로제: "#e597a4",
  스파클링: "#a9b86b",
  디저트: "#c98a3c",
  주정강화: "#6b3a2a",
};
// 공유 링크 하나에 담는 와인 수 상한. 공개 페이지가 한 번에 그리는 사진 수이기도 하다.
export const WINE_SHARE_MAX_WINES = 60;
export const WINE_SHARE_DAYS = 14;
export type WineSharePriceDisplay = "none" | "band" | "exact";
// 공개 페이지에 내보내는 와인 정보. 재고·구입일·작성자·평점·관리 번호는 넣지 않는다.
export type PublicShareWine = {
  id: string;
  no: number;
  name: string;
  english_name: string;
  producer: string;
  type: string;
  country: string;
  region: string;
  grapes: string;
  vintage_kind: string;
  vintage: number | null;
  volume_ml: number | null;
  photo: string | null;
  price: string | null;
};
export type PublicShare = {
  title: string;
  note: string;
  created_at: string;
  expires_at: string;
  max_picks: number;
  show_results: boolean;
  price_display: WineSharePriceDisplay;
  wines: PublicShareWine[];
  voters: number;
  // show_results일 때만 채운다. 와인 id별 선택 수.
  tally: Record<string, number> | null;
};
// 셀러의 "공유한 목록" 화면 한 줄. 받은 선택을 함께 담는다.
export type WineShareSummary = {
  id: string;
  token: string;
  title: string;
  note: string;
  wine_ids: string[];
  price_display: WineSharePriceDisplay;
  max_picks: number;
  show_results: boolean;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  active: boolean;
  votes: {
    share_id: string;
    name: string;
    picks: string[];
    comment: string;
    updated_at: string;
  }[];
};
// 공유 페이지의 외부 정보 링크. 이름의 괄호 설명과 연도를 빼야 검색이 맞는다
// (예: "뵈브 클리코 브뤼 (옐로우 라벨) 샴페인" → "뵈브 클리코 브뤼 샴페인").
export const wineSearchName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// 네이버 지식백과는 한글·영어 이름 모두 찾고 와인21·1001 와인 항목으로 이어진다.
// Vivino는 한글 이름으로는 찾지 못하므로 영어 이름이 있을 때만 만든다. 영어 이름에 생산자가
// 빠져 있으면("Gran Reserva 904") 다른 생산자의 같은 이름이 먼저 나오므로 생산자를 앞에 붙인다.
export function wineInfoLinks(w: {
  name: string;
  english_name: string;
  producer: string;
}) {
  const ko = wineSearchName(w.name),
    producer = w.producer.trim();
  let en = wineSearchName(w.english_name);
  // 생산자 이름의 단어(4글자 이상) 하나라도 이미 있으면 붙이지 않는다("Catena Zapata" + "Catena Malbec").
  const lower = en.toLowerCase();
  if (
    en &&
    producer &&
    !producer
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.length >= 4 && lower.includes(word))
  )
    en = `${producer} ${en}`;
  const q = ko || en;
  return {
    naver: q
      ? `https://terms.naver.com/search.naver?query=${encodeURIComponent(q)}`
      : null,
    vivino: en
      ? `https://www.vivino.com/search/wines?q=${encodeURIComponent(en)}`
      : null,
  };
}
