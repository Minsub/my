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
export type WineFilters = Partial<
  Record<
    | "q"
    | "type"
    | "country"
    | "region"
    | "grape"
    | "vintage"
    | "min_price"
    | "max_price"
    | "from"
    | "to"
    | "min_score"
    | "sort"
    | "stock"
    | "archived",
    string
  >
>;
export function filterWines(rows: CellarWine[], f: WineFilters) {
  const result = rows.filter(
    (w) =>
      w.archived === (f.archived === "true") &&
      (f.stock === "all" || w.stock > 0) &&
      (!f.q ||
        [w.name, w.english_name, w.producer, w.grapes, w.region]
          .join(" ")
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!f.type ||
        (f.type === "샴페인"
          ? champagne(w)
          : f.type === "기타 스파클링"
            ? w.type === "스파클링" && !champagne(w)
            : w.type === f.type)) &&
      (!f.country || w.country === f.country) &&
      (!f.region || w.region === f.region) &&
      (!f.grape || w.grapes.toLowerCase().includes(f.grape.toLowerCase())) &&
      (!f.vintage ||
        (f.vintage === "NV"
          ? w.vintage_kind === "non_vintage"
          : String(w.vintage) === f.vintage)) &&
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
