export type CashRow = {
  id: string;
  date: string;
  member: string;
  type: string;
  category: string;
  subCategory: string;
  memo: string;
  asset: string;
  amount: number;
  currency: string;
  originalAmount: number | null;
};
export type CashMeta = {
  rows: number;
  incomeRows: number;
  expenseRows: number;
  otherRows: number;
  negativeRows: number;
  zeroRows: number;
  firstDate: string;
  lastDate: string;
  income: number;
  expense: number;
  sheets: number;
};
export type CashFile = {
  id: string;
  filename: string;
  version: number;
  content_hash: string;
  bytes: number;
  metadata: CashMeta;
  updated_at: string;
  canEdit: boolean;
};
export type CashFilter = {
  from: string;
  to: string;
  member: string;
  q: string;
  excludeLarge: boolean;
  expandOther: boolean;
  includeIncome: string[];
  excludeExpense: string[];
  asset: string;
};
export type CashPeriod = {
  period: string;
  income: number;
  expense: number;
  saved: number;
  months: number;
  averageExpense: number;
  savingRate: number | null;
};
export type CashCategory = {
  name: string;
  amount: number;
  count: number;
  values: number[];
  children: { name: string; amount: number; values: number[] }[];
};
export type CashDashboard = {
  files: CashFile[];
  filter: CashFilter;
  total: CashPeriod;
  months: CashPeriod[];
  years: CashPeriod[];
  periods: string[];
  income: CashCategory[];
  expense: CashCategory[];
  assets: { name: string; amount: number }[];
  options: {
    members: string[];
    income: string[];
    expense: string[];
    assets: string[];
    firstMonth: string;
    lastMonth: string;
  };
  granularity: "year" | "month";
  count: number;
  coverage: { member: string; lastDate: string }[];
};
export function monthRange(from: string, to: string) {
  const result: string[] = [];
  let year = Number(from.slice(0, 4)),
    month = Number(from.slice(5, 7));
  while (
    `${year}-${String(month).padStart(2, "0")}` <= to &&
    result.length < 1200
  ) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    if (++month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}
export const categoryName = (r: CashRow, expand = false) =>
  expand && r.category === "기타" ? `기타 · ${r.memo || "미기입"}` : r.category;
export function filteredCash(rows: CashRow[], f: CashFilter) {
  return rows.filter(
    (r) =>
      (r.type === "수입" || r.type === "지출") &&
      r.date.slice(0, 7) >= f.from &&
      r.date.slice(0, 7) <= f.to &&
      (!f.member || r.member === f.member) &&
      (!f.asset || r.asset === f.asset) &&
      (!f.q ||
        `${r.memo} ${r.category} ${r.subCategory} ${r.asset}`
          .toLocaleLowerCase("ko")
          .includes(f.q.toLocaleLowerCase("ko"))) &&
      !(
        r.type === "지출" &&
        r.category === "선물" &&
        r.subCategory === "계좌이체"
      ) &&
      !(f.excludeLarge && r.type === "지출" && r.amount >= 10000000) &&
      !(
        r.type === "수입" &&
        f.includeIncome.length &&
        !f.includeIncome.includes(r.category)
      ) &&
      !(r.type === "지출" && f.excludeExpense.includes(r.category)),
  );
}
function periodRow(
  period: string,
  rows: CashRow[],
  months: number,
): CashPeriod {
  const income = rows.reduce(
      (n, r) => n + (r.type === "수입" ? r.amount : 0),
      0,
    ),
    expense = rows.reduce((n, r) => n + (r.type === "지출" ? r.amount : 0), 0);
  return {
    period,
    income,
    expense,
    saved: income - expense,
    months,
    averageExpense: months ? expense / months : 0,
    savingRate: income > 0 ? (income - expense) / income : null,
  };
}
export function aggregateCash(
  all: CashRow[],
  files: CashFile[],
  filter: CashFilter,
  granularity: "year" | "month",
): CashDashboard {
  const rows = filteredCash(all, filter),
    keys = monthRange(filter.from, filter.to);
  const months = keys.map((m) =>
    periodRow(
      m,
      rows.filter((r) => r.date.startsWith(m)),
      1,
    ),
  );
  const years = [...new Set(keys.map((m) => m.slice(0, 4)))].map((y) =>
    periodRow(
      y,
      rows.filter((r) => r.date.startsWith(y)),
      keys.filter((m) => m.startsWith(y)).length,
    ),
  );
  const periods = (granularity === "year" ? years : months).map(
    (x) => x.period,
  );
  function categories(type: string): CashCategory[] {
    const groups = new Map<string, CashRow[]>();
    for (const row of rows.filter((r) => r.type === type)) {
      const name = categoryName(row, filter.expandOther);
      groups.set(name, [...(groups.get(name) || []), row]);
    }
    const values = (items: CashRow[]) =>
      periods.map((p) =>
        items
          .filter((r) => r.date.startsWith(p))
          .reduce((n, r) => n + r.amount, 0),
      );
    return [...groups]
      .map(([name, items]) => ({
        name,
        amount: items.reduce((n, r) => n + r.amount, 0),
        count: items.length,
        values: values(items),
        children: [...new Set(items.map((r) => r.subCategory || "미분류"))].map(
          (name) => {
            const children = items.filter(
              (r) => (r.subCategory || "미분류") === name,
            );
            return {
              name,
              amount: children.reduce((n, r) => n + r.amount, 0),
              values: values(children),
            };
          },
        ),
      }))
      .sort(
        (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "ko"),
      );
  }
  const unique = (type: string) =>
    [
      ...new Set(all.filter((r) => r.type === type).map((r) => r.category)),
    ].sort((a, b) => a.localeCompare(b, "ko"));
  const sortedMonths = all.map((r) => r.date.slice(0, 7)).sort();
  return {
    files,
    filter,
    total: periodRow("전체", rows, keys.length),
    months,
    years,
    periods,
    income: categories("수입"),
    expense: categories("지출"),
    assets: [
      ...new Set(rows.filter((r) => r.type === "지출").map((r) => r.asset)),
    ]
      .map((name) => ({
        name: name || "미입력",
        amount: rows
          .filter((r) => r.type === "지출" && r.asset === name)
          .reduce((n, r) => n + r.amount, 0),
      }))
      .sort((a, b) => b.amount - a.amount),
    options: {
      members: files.map((f) => f.filename.replace(/\.xlsx$/i, "")),
      income: unique("수입"),
      expense: unique("지출"),
      assets: [...new Set(all.map((r) => r.asset).filter(Boolean))].sort(),
      firstMonth: sortedMonths[0] || "",
      lastMonth: sortedMonths.at(-1) || "",
    },
    granularity,
    count: rows.length,
    coverage: files.map((f) => ({
      member: f.filename.replace(/\.xlsx$/i, ""),
      lastDate: f.metadata.lastDate,
    })),
  };
}
export const cashMoney = (n: number) =>
  `${Math.round(n).toLocaleString("ko-KR")}원`;
export function compactMoney(n: number) {
  const a = Math.abs(n);
  return a >= 10000
    ? `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`
    : cashMoney(n);
}
export const cashPct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
export const changeRate = (now: number, before: number) =>
  before > 0 ? (now - before) / before : null;
export function cashSummaryMarkdown(d: CashDashboard) {
  const table = (header: string[], rows: (string | number)[][]) =>
    [
      header.join(" | "),
      header.map(() => "---").join(" | "),
      ...rows.map((r) =>
        r
          .map((v) =>
            String(v)
              .replace(/\|/g, "\\|")
              .replace(/[\r\n]/g, " "),
          )
          .join(" | "),
      ),
    ].join("\n");
  const period = (rows: CashPeriod[]) =>
    table(
      [
        "기간",
        "수입(원)",
        "지출(원)",
        "수입−지출(원)",
        "저축률",
        "월평균 지출(원)",
      ],
      rows.map((r) => [
        r.period,
        r.income,
        r.expense,
        r.saved,
        cashPct(r.savingRate),
        Math.round(r.averageExpense),
      ]),
    );
  return `# MONO 가계부 요약\n\n기간: ${d.filter.from} ~ ${d.filter.to}\n\n필터: ${JSON.stringify(d.filter)}\n\n수입−지출은 계좌 잔액이 아닙니다. 이체·차액 및 선물/계좌이체 지출 제외. 최종 거래일은 입력 완료일을 보장하지 않습니다.\n\n${d.coverage.map((f) => `${f.member}: 최종 기록 ${f.lastDate}`).join("\n")}\n\n## 연도별\n${period(d.years)}\n\n## 월별\n${period(d.months)}\n\n${(
    ["income", "expense"] as const
  )
    .map(
      (key) =>
        `## ${key === "income" ? "수입" : "지출"} 분류\n${table(
          ["분류", ...d.periods, "합계(원)"],
          d[key].map((r) => [r.name, ...r.values, r.amount]),
        )}`,
    )
    .join("\n\n")}\n`;
}
