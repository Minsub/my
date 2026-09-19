import { describe, it, expect } from "vitest";
import { commandSchemas, commandScopes } from "../src/lib/contracts";
import { allScopes } from "../src/lib/types";
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
describe("자산 명령 검증", () => {
  const key = "11111111-2222-4333-8444-555555555555";
  const owner = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
  const record = (input: Record<string, unknown>) =>
    commandSchemas.asset_record_snapshot.safeParse({
      idempotency_key: key,
      owner_id: owner,
      items: [{ group_key: "kr_stock", name: "삼성전자", amount: 1000 }],
      ...input,
    });
  it("모든 명령이 scope 맵에 들어 있다", () => {
    for (const operation of Object.keys(commandSchemas))
      expect(operation in commandScopes, operation).toBe(true);
    for (const scope of Object.values(commandScopes))
      if (scope) expect(allScopes).toContain(scope);
    expect(commandScopes.asset_record_snapshot).toBe("asset:write");
    expect(commandScopes.wine_create).toBe("wine:write");
  });
  it("기준일을 생략하면 오늘로 기록한다", () => {
    const parsed = record({});
    expect(parsed.success).toBe(true);
    expect(parsed.data!.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.data!.expected_version).toBeNull();
  });
  it("소유자를 정확히 한 가지 방법으로만 지정한다", () => {
    expect(record({ owner_id: undefined, owner_name: "민섭" }).success).toBe(
      true,
    );
    expect(record({ owner_name: "민섭" }).success).toBe(false);
    expect(record({ owner_id: undefined }).success).toBe(false);
  });
  it("금액과 그룹을 검증한다", () => {
    expect(
      record({ items: [{ group_key: "없는그룹", name: "t", amount: 1 }] })
        .success,
    ).toBe(false);
    expect(
      record({ items: [{ group_key: "kr_stock", name: "t", amount: -1 }] })
        .success,
    ).toBe(false);
    expect(
      record({ items: [{ group_key: "kr_stock", name: "t", amount: 1.5 }] })
        .success,
    ).toBe(false);
    // 원두 가격 한도(1억)가 아니라 자산 한도(1조)를 쓴다.
    expect(
      record({
        items: [{ group_key: "kr_stock", name: "t", amount: 470914060 }],
      }).success,
    ).toBe(true);
    expect(
      record({
        items: [{ group_key: "kr_stock", name: "t", amount: 1000000000001 }],
      }).success,
    ).toBe(false);
    expect(record({ items: [] }).success).toBe(false);
  });
  it("같은 그룹의 종목이 여러 개여도 받는다", () => {
    // 미국 국채처럼 같은 이름이 여러 번 나오는 자료가 실제로 있다.
    expect(
      record({
        items: [
          { group_key: "foreign_bond", name: "미국 국채", amount: 1 },
          { group_key: "foreign_bond", name: "미국 국채", amount: 2 },
        ],
      }).success,
    ).toBe(true);
  });
  it("소유자 이름을 다듬고 길이를 제한한다", () => {
    const parsed = commandSchemas.asset_save_owner.safeParse({
      idempotency_key: key,
      name: "  민섭  ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.name).toBe("민섭");
    expect(parsed.data!.link_to_me).toBeUndefined();
    expect(
      commandSchemas.asset_save_owner.safeParse({
        idempotency_key: key,
        name: "가".repeat(41),
      }).success,
    ).toBe(false);
  });
});
