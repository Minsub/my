import { describe, it, expect } from "vitest";
import { wineFacts, filterWines, champagne } from "../src/lib/wine-cellar";
import type { Wine, Snapshot } from "../src/lib/types";
const w: Wine = {
  id: "one",
  display_id: 1,
  name: "와인",
  english_name: "Wine",
  producer: "",
  type: "스파클링",
  country: "프랑스",
  region: "Champagne",
  grapes: "Chardonnay",
  vintage_kind: "year",
  vintage: 2020,
  volume_ml: 750,
  stock: 2,
  version: 1,
  archived: false,
  created_by: null,
  reference_price: 50000,
  reference_purchased_on: "2024-01-01",
};
const empty = { events: [], purchases: [], tastings: [] } as Pick<
  Snapshot,
  "events" | "purchases" | "tastings"
>;
describe("wine cellar facts", () => {
  it("keeps imported price/date without fabricating a purchase", () =>
    expect(wineFacts(w, empty)).toMatchObject({
      price: 50000,
      purchased_on: "2024-01-01",
      price_source: "import",
    }));
  it("ignores reversed receipts, retaining unknown price on the newest valid purchase", () => {
    const data = {
      ...empty,
      purchases: [
        {
          id: "p1",
          wine_id: w.id,
          unit_price: 90000,
          purchased_on: "2026-09-01",
          quantity: 1,
          store: "",
        },
        {
          id: "p2",
          wine_id: w.id,
          unit_price: null,
          purchased_on: "2026-08-01",
          quantity: 1,
          store: "",
        },
      ],
      events: [
        { id: "e1", wine_id: w.id, kind: "receive", purchase_id: "p1" },
        { id: "e2", wine_id: w.id, kind: "receive", purchase_id: "p2" },
        { id: "r1", reverses_id: "e1" },
      ],
    };
    const complete = {
      ...data,
      events: data.events.map((e) => ({
        wine_id: w.id,
        kind: "reverse",
        delta: 1,
        occurred_on: "2026-09-01",
        created_at: "2026-09-01T00:00:00Z",
        created_by: "user",
        reason: "",
        reverses_id: null,
        ...e,
      })),
    };
    expect(wineFacts(w, complete)).toMatchObject({
      price: null,
      purchased_on: "2026-08-01",
    });
  });
  it("keeps missing prices last in both directions and applies intersecting filters", () => {
    const a = wineFacts(w, empty),
      b = { ...a, id: "two", price: 10000 },
      c = { ...a, id: "three", price: null };
    expect(
      filterWines([a, b, c], { sort: "price_desc" }).map((x) => x.id),
    ).toEqual(["one", "two", "three"]);
    expect(
      filterWines([a, b, c], { sort: "price_asc" }).map((x) => x.id),
    ).toEqual(["two", "one", "three"]);
    expect(
      filterWines([a, b, c], {
        min_price: "20000",
        country: "프랑스",
        type: "샴페인",
        from: "2024-01-01",
        to: "2024-01-01",
        grape: "chardonnay",
      }),
    ).toHaveLength(1);
    expect(filterWines([a, b, c], { country: "이탈리아" })).toHaveLength(0);
  });
  it("distinguishes Champagne from other sparkling wine", () => {
    expect(champagne(w)).toBe(true);
    expect(champagne({ ...w, region: "Burgundy" })).toBe(false);
    expect(champagne({ ...w, country: "미국" })).toBe(false);
  });
});
