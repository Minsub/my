import { describe, it, expect } from "vitest";
import { commandSchemas } from "../src/lib/contracts";
import { kgPrice, dateLabel } from "../src/lib/format";
import { parseAirtable } from "../scripts/import";
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
});
