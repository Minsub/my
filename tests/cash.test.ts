import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { cashFilename, parseCashWorkbook } from "../src/server/cash-parser";
import {
  aggregateCash,
  filteredCash,
  monthRange,
  type CashFilter,
} from "../src/lib/cash";
import { cashWorkbook } from "./cash-fixture";
const filter: CashFilter = {
  from: "2026-01",
  to: "2026-03",
  member: "",
  q: "",
  excludeLarge: false,
  expandOther: false,
  includeIncome: [],
  excludeExpense: [],
  asset: "",
};
describe("cashbook parsing and analysis", () => {
  it("preserves raw currency, refund signs, zero and transfer records", () => {
    const p = parseCashWorkbook(cashWorkbook(), "테스트.xlsx");
    expect(p.rows).toHaveLength(7);
    expect(p.rows[3]).toMatchObject({
      amount: 9000,
      originalAmount: 10,
      currency: "NZD",
    });
    expect(p.rows[2].amount).toBe(-2000);
    expect(p.metadata).toMatchObject({
      rows: 7,
      negativeRows: 1,
      zeroRows: 1,
      otherRows: 1,
    });
  });
  it("normalizes Unicode filenames and rejects unsafe names", () => {
    expect(cashFilename(" 장미.XLSX ").key).toBe(
      cashFilename("장미.xlsx".normalize("NFD")).key,
    );
    expect(() => cashFilename("../a.xlsx")).toThrow();
    expect(() => cashFilename("~$가계부.xlsx")).toThrow();
  });
  it("rejects corrupt files and missing business columns", () => {
    expect(() =>
      parseCashWorkbook(Buffer.from("not xlsx"), "a.xlsx"),
    ).toThrow();
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.aoa_to_sheet([["잘못된 열"], [1]]),
      "내역",
    );
    expect(() =>
      parseCashWorkbook(
        XLSX.write(w, { bookType: "xlsx", type: "buffer" }),
        "a.xlsx",
      ),
    ).toThrow("필수 열");
  });
  it("rejects business formulas even with cached values", () => {
    const w = XLSX.read(cashWorkbook());
    w.Sheets["내역"].F2 = { t: "n", f: "1+1", v: 2 };
    expect(() =>
      parseCashWorkbook(
        XLSX.write(w, { bookType: "xlsx", type: "buffer" }),
        "a.xlsx",
      ),
    ).toThrow("수식");
  });
  it("uses calendar months including zero-activity months and identical exclusions for totals and details", () => {
    const rows = parseCashWorkbook(cashWorkbook(), "a.xlsx").rows;
    const d = aggregateCash(rows, [], filter, "month");
    expect(d.periods).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(d.total).toMatchObject({
      income: 100000,
      expense: 19000,
      months: 3,
    });
    expect(d.months[1].expense).toBe(0);
    expect(d.total.averageExpense).toBe(19000 / 3);
    expect(filteredCash(rows, filter)).toHaveLength(5);
    expect(d.expense.reduce((s, r) => s + r.amount, 0)).toBe(d.total.expense);
    const excluded = aggregateCash(
      rows,
      [],
      { ...filter, excludeExpense: ["여행"] },
      "month",
    );
    expect(excluded.total).toMatchObject({ expense: 10000, months: 3 });
  });
  it("does not deduplicate identical transactions", () => {
    const p = parseCashWorkbook(cashWorkbook(), "a.xlsx");
    expect(filteredCash([...p.rows, p.rows[1]], filter)).toHaveLength(6);
  });
  it("uses literal calendar days for Excel dates and supports old years", () => {
    const w = XLSX.read(cashWorkbook());
    w.Sheets["내역"].A2 = { t: "n", v: 46023 };
    const p = parseCashWorkbook(
      XLSX.write(w, { bookType: "xlsx", type: "buffer" }),
      "a.xlsx",
    );
    expect(p.rows[0].date).toBe("2026-01-01");
    expect(monthRange("2000-12", "2001-02")).toEqual([
      "2000-12",
      "2001-01",
      "2001-02",
    ]);
  });
});

describe("cash flow views", () => {
  it("keeps partial-year calendar averages, refunds, zero categories and child shares aligned", async () => {
    const { cashView } = await import("../src/lib/cash-analysis");
    const rows = parseCashWorkbook(cashWorkbook(22000), "a.xlsx").rows;
    const all = [
      ...rows,
      { ...rows[1], id: "prior", date: "2025-12-12", amount: 12000 },
    ];
    const data = aggregateCash(
      all,
      [],
      { ...filter, from: "2025-12" },
      "month",
    );
    const year = cashView(data, "year", "2026");
    expect(year.periods).toEqual(["2025", "2026"]);
    expect(year.source.map((r) => r.months)).toEqual([1, 3]);
    expect(year.expense.find((r) => r.name === "식비")?.values).toEqual([
      12000, 20000,
    ]);
    const monthly = cashView(data, "month", "2026");
    expect(monthly.periods).toEqual(["2026-01", "2026-02", "2026-03"]);
    const food = monthly.expense.find((r) => r.name === "식비")!;
    expect(food.children[0].values).toEqual([20000, 0, 0]);
    expect(food.amount / monthly.source.length).toBeCloseTo(6666.6667);
    expect(monthly.expense.find((r) => r.name === "기타")?.values).toEqual([
      0, 0, 0,
    ]);
  });
  it("summarizes every matching transaction for a chart before pagination", async () => {
    const { cashTimeline } = await import("../src/lib/cash-analysis");
    const rows = filteredCash(
      parseCashWorkbook(cashWorkbook(), "a.xlsx").rows,
      filter,
    );
    const timeline = cashTimeline(rows);
    expect(timeline).toEqual([
      { period: "2026-01", income: 100000, expense: 10000 },
      { period: "2026-03", income: 0, expense: 9000 },
    ]);
    expect(cashTimeline(rows.filter((r) => r.category === "식비"))).toEqual([
      { period: "2026-01-12", income: 0, expense: 12000 },
      { period: "2026-01-13", income: 0, expense: -2000 },
    ]);
  });
});
