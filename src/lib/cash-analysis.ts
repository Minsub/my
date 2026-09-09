import { type CashCategory, type CashDashboard, type CashRow } from "./cash";
export function cashView(
  data: CashDashboard,
  granularity: "year" | "month",
  year: string,
) {
  const source =
    granularity === "year"
      ? data.years
      : data.months.filter((m) => m.period.startsWith(year));
  const periods = source.map((p) => p.period);
  const indices = periods.map((p) =>
    data.periods.flatMap((key, i) => (key.startsWith(p) ? [i] : [])),
  );
  function remap(rows: CashCategory[]) {
    return rows
      .map((r) => {
        const values = indices.map((ii) =>
          ii.reduce((n, i) => n + r.values[i], 0),
        );
        return {
          ...r,
          values,
          amount: values.reduce((n, v) => n + v, 0),
          children: r.children.map((c) => {
            const values = indices.map((ii) =>
              ii.reduce((n, i) => n + c.values[i], 0),
            );
            return { ...c, values, amount: values.reduce((n, v) => n + v, 0) };
          }),
        };
      })
      .sort(
        (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "ko"),
      );
  }
  return {
    periods,
    source,
    income: remap(data.income),
    expense: remap(data.expense),
  };
}
export function cashTimeline(rows: CashRow[]) {
  const daily = new Set(rows.map((r) => r.date.slice(0, 7))).size === 1;
  const map = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const key = daily ? r.date : r.date.slice(0, 7);
    const value = map.get(key) || { income: 0, expense: 0 };
    if (r.type === "수입") value.income += r.amount;
    if (r.type === "지출") value.expense += r.amount;
    map.set(key, value);
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, ...value }));
}
