import { describe, it, expect } from "vitest";
import { commandSchemas } from "../src/lib/contracts";
import { kgPrice, dateLabel } from "../src/lib/format";
import { hasImportedTasting, parseAirtable } from "../scripts/import";
import { seedBrands, seedBeans } from "../src/lib/seed-data";
describe("input and migration semantics", () => {
  it("preserves calendar dates and displays timestamps in Korea time", () => {
    expect(dateLabel("2026-09-08")).toBe("2026.09.08");
    expect(dateLabel("2026-09-07T15:30:00.000Z")).toBe("2026.09.08");
    expect(dateLabel(null)).toBe("날짜 미상");
  });
  it("calculates kg price without inventing missing weights", () => {
    expect(kgPrice(15000, 200)).toBe(75000);
    expect(kgPrice(15000, null)).toBeNull();
    expect(kgPrice(0, 200)).toBe(0);
  });
  it("retains original bean quantities and preferences", () => {
    expect(seedBrands).toHaveLength(10);
    expect(seedBeans).toHaveLength(11);
    expect(seedBeans.find((b) => b.name.includes("프루티봉봉"))).toMatchObject({
      grind: 11,
      dose: 6,
      recommendation: "추천",
    });
  });
  it("rejects negative and non-integer consumption", () => {
    for (const quantity of [-1, 0, 1.5])
      expect(
        commandSchemas.wine_consume.safeParse({
          wine_id: crypto.randomUUID(),
          idempotency_key: crypto.randomUUID(),
          quantity,
        }).success,
      ).toBe(false);
  });
  it("does not accept arbitrary actor IDs in tools", () => {
    expect(
      commandSchemas.wine_create.safeParse({
        idempotency_key: crypto.randomUUID(),
        name: "Wine",
        type: "레드",
        household_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejects malformed Airtable inventory before applying changes", () => {
    expect(() =>
      parseAirtable(
        {
          records: [
            {
              id: "r1",
              fields: { "한글 이름": "테스트", 종류: "레드", 수량: -2 },
            },
          ],
        },
        "wines",
      ),
    ).toThrow();
  });
  it("preserves legacy field-ID mapping and zero ratings", () => {
    const [r] = parseAirtable(
      {
        records: [
          {
            id: "r1",
            fields: {
              fldaoCORde1HgHRok: "테스트",
              fld6m7oC81YO6GdTj: "레드",
              fldyNUSLA0nT6dlsY: 2,
              fld7e7VVcoVqfGNix: 0,
            },
          },
        ],
      },
      "wines",
    );
    expect(r).toMatchObject({
      name: "테스트",
      quantity: 2,
      score: 0,
      vintage: null,
    });
  });
  it("preserves Airtable field names without spaces and unchecked repurchase", () => {
    const [record] = parseAirtable(
      {
        records: [
          {
            id: "source-1",
            fields: {
              "한글 이름": "이관 와인",
              종류: "레드",
              수량: 0,
              시음노트: "(2026-05-21) 첫 기록\n두 번째 줄",
              재구매의사: false,
              구매가: 45000,
              구매일: "2026-04-01",
            },
          },
        ],
      },
      "wines",
    );
    expect(record).toMatchObject({
      quantity: 0,
      note: "(2026-05-21) 첫 기록\n두 번째 줄",
      repurchase: false,
      raw: { 구매가: 45000, 구매일: "2026-04-01" },
    });
  });
  it("does not invent tasting history from a default unchecked field", () => {
    expect(
      hasImportedTasting({ note: "", score: null, repurchase: false }),
    ).toBe(false);
    expect(
      hasImportedTasting({ note: "", score: null, repurchase: true }),
    ).toBe(true);
    expect(hasImportedTasting({ note: "", score: 0, repurchase: false })).toBe(
      true,
    );
    expect(
      hasImportedTasting({
        note: "재구매 안 함",
        score: null,
        repurchase: false,
      }),
    ).toBe(true);
  });
});
