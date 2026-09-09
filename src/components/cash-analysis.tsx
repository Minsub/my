"use client";
import { useState } from "react";
import { ChevronDown, TrendingUp, ArrowLeft, ArrowRight } from "lucide-react";
import {
  cashMoney,
  compactMoney,
  cashPct,
  changeRate,
  type CashDashboard,
  type CashCategory,
} from "@/lib/cash";
import { cashView } from "@/lib/cash-analysis";
import { CashModal } from "./cash-detail";
import { CashPlot, cashColor, type CashSeries } from "./cash-chart";

type Drill = (
  period?: string,
  category?: string,
  kind?: string,
  sub?: string,
) => void;
type Insight =
  | {
      title: string;
      kind: "average" | "breakdown";
      period: string;
      rows: CashCategory[];
      months: number;
      type: string;
    }
  | {
      title: string;
      kind: "trend";
      periods: string[];
      series: CashSeries[];
      totals: number[];
      type: string;
      category?: string;
      sub?: string;
    };
function Spark({ values, name }: { values: number[]; name: string }) {
  const lo = Math.min(0, ...values),
    span = Math.max(1, ...values) - lo;
  return (
    <svg className="cash-spark" viewBox="0 0 120 36" aria-hidden="true">
      <polyline
        fill="none"
        stroke={cashColor(name)}
        strokeWidth="2.5"
        points={values
          .map(
            (v, i) =>
              `${2 + (i * 116) / Math.max(1, values.length - 1)},${32 - ((v - lo) / span) * 28}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
function PeriodPicker({
  periods,
  value,
  onChange,
  label = "비교 기간",
}: {
  periods: string[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const i = periods.indexOf(value);
  return (
    <div className="cash-period-picker">
      <button
        aria-label="이전 기간"
        disabled={i <= 0}
        onClick={() => onChange(periods[i - 1])}
      >
        <ArrowLeft size={16} />
      </button>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {periods.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <button
        aria-label="다음 기간"
        disabled={i >= periods.length - 1}
        onClick={() => onChange(periods[i + 1])}
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function CashAnalysis({
  data,
  tab,
  drill,
}: {
  data: CashDashboard;
  tab: string;
  drill: Drill;
}) {
  const [type, setType] = useState("지출");
  const [units, setUnits] = useState<Record<string, "year" | "month">>({});
  const [years, setYears] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [averageFlow, setAverageFlow] = useState(false);
  const [measure, setMeasure] = useState<"amount" | "share">("amount");
  const unitKey = `${tab}:${type}`;
  const granularity = units[unitKey] || "year";
  const year = data.years.some((y) => y.period === years[unitKey])
    ? years[unitKey]
    : data.years.at(-1)?.period || "";
  const view = cashView(data, granularity, year);
  const rows = type === "수입" ? view.income : view.expense;
  const totals = view.source.map((p) =>
    type === "수입" ? p.income : p.expense,
  );
  const period = view.periods.includes(selected)
    ? selected
    : view.periods.at(-1) || "";
  const pi = view.periods.indexOf(period);
  const toggle = (name: string) =>
    setExpanded(
      expanded.includes(name)
        ? expanded.filter((n) => n !== name)
        : [...expanded, name],
    );
  const subset = (items: CashCategory[], i: number) =>
    items
      .map((r) => ({
        ...r,
        amount: r.values[i],
        children: r.children.map((c) => ({ ...c, amount: c.values[i] })),
      }))
      .sort((a, b) => b.amount - a.amount);
  function breakdown(p: string, average = false) {
    const v =
      p.length === 4
        ? cashView(data, "year", p)
        : cashView(data, "month", p.slice(0, 4));
    const i = v.periods.indexOf(p);
    if (i < 0) return;
    const t = average ? "지출" : type;
    setInsight({
      kind: average ? "average" : "breakdown",
      title: `${p}${p.length === 4 ? "년" : ""} ${average ? "항목별 월 평균 지출" : `${t} 항목별 비중`}`,
      period: p,
      rows: subset(t === "수입" ? v.income : v.expense, i),
      months: v.source[i].months,
      type: t,
    });
  }
  function trend(row?: CashCategory, child?: CashCategory["children"][number]) {
    const items = child
      ? [
          {
            name: `${row!.name} / ${child.name}`,
            values: child.values,
            color: cashColor(row!.name),
          },
        ]
      : row
        ? [{ name: row.name, values: row.values }]
        : rows.map((r) => ({ name: r.name, values: r.values }));
    setInsight({
      kind: "trend",
      title: `${child ? `${row!.name} / ${child.name}` : row?.name || "전체 항목 비교"} 추이`,
      periods: view.periods,
      series: items,
      totals,
      type,
      category: row?.name,
      sub: child?.name,
    });
  }
  const controls = (
    <div className="cash-analysis-controls">
      <div className="cash-segments" aria-label="수입 지출 선택">
        {["지출", "수입"].map((t) => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="cash-segments" aria-label="기간 단위">
        {(["year", "month"] as const).map((u) => (
          <button
            key={u}
            aria-pressed={granularity === u}
            onClick={() => setUnits({ ...units, [unitKey]: u })}
          >
            {u === "year" ? "연도별" : "월별"}
          </button>
        ))}
      </div>
      {granularity === "month" && (
        <select
          aria-label="분석 연도"
          value={year}
          onChange={(e) => setYears({ ...years, [unitKey]: e.target.value })}
        >
          {data.years.map((y) => (
            <option key={y.period} value={y.period}>
              {y.period}년
            </option>
          ))}
        </select>
      )}
    </div>
  );
  return (
    <div className="cash-analysis">
      {tab === "summary" && (
        <section className="panel cash-year-panel">
          <div className="section-heading">
            <div>
              <span className="cash-section-kicker">YEAR BY YEAR</span>
              <h2>연도별 요약</h2>
            </div>
            <span className="cash-note">월평균 → 항목별 분석</span>
          </div>
          <div
            className="cash-table-scroll"
            role="region"
            aria-label="연도별 요약 표"
            tabIndex={0}
          >
            <table className="cash-year-table">
              <caption>연도별 수입·지출 비교 (원)</caption>
              <thead>
                <tr>
                  <th scope="col">연도</th>
                  <th scope="col">수입</th>
                  <th scope="col">지출</th>
                  <th scope="col">월평균 지출 ↗</th>
                  <th scope="col" className="cash-wide-cell">
                    전년 대비 지출
                  </th>
                  <th scope="col" className="cash-wide-cell">
                    수입 − 지출
                  </th>
                  <th scope="col" className="cash-wide-cell">
                    저축률
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.years.map((y, i) => {
                  const prev = data.years[i - 1],
                    rate =
                      prev && prev.months === 12 && y.months === 12
                        ? changeRate(y.expense, prev.expense)
                        : null;
                  return (
                    <tr key={y.period}>
                      <th scope="row">
                        <button onClick={() => drill(y.period)}>
                          {y.period}
                          <small>{y.months}개월</small>
                        </button>
                      </th>
                      <td className="cash-income">
                        <button
                          aria-label={`${y.period}년 수입 내역`}
                          onClick={() => drill(y.period, undefined, "수입")}
                        >
                          <span className="cash-exact">
                            {cashMoney(y.income)}
                          </span>
                          <span className="cash-compact">
                            {compactMoney(y.income)}
                          </span>
                        </button>
                      </td>
                      <td className="cash-expense">
                        <button
                          aria-label={`${y.period}년 지출 내역`}
                          onClick={() => drill(y.period, undefined, "지출")}
                        >
                          <span className="cash-exact">
                            {cashMoney(y.expense)}
                          </span>
                          <span className="cash-compact">
                            {compactMoney(y.expense)}
                          </span>
                        </button>
                      </td>
                      <td className="cash-average-cell">
                        <button
                          aria-label={`${y.period}년 항목별 월 평균 지출`}
                          onClick={() => breakdown(y.period, true)}
                        >
                          <span className="cash-exact">
                            {cashMoney(y.averageExpense)}
                          </span>
                          <span className="cash-compact">
                            {compactMoney(y.averageExpense)}
                          </span>
                        </button>
                      </td>
                      <td
                        className={`cash-wide-cell ${rate && rate > 0 ? "cash-expense" : "cash-income"}`}
                      >
                        {rate === null
                          ? "—"
                          : `${rate > 0 ? "+" : ""}${cashPct(rate)}`}
                      </td>
                      <td className="cash-wide-cell">
                        {compactMoney(y.saved)}
                      </td>
                      <td className="cash-wide-cell">
                        {cashPct(y.savingRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="cash-note">
            선택한 달력월 기준 평균 · 12개월끼리만 전년 대비 비교
          </p>
        </section>
      )}
      <section className="panel cash-flow-panel">
        <div className="section-heading">
          <div>
            <span className="cash-section-kicker">
              {tab === "summary" ? "THE FLOW" : "CATEGORY EXPLORER"}
            </span>
            <h2>
              {tab === "summary" ? "연도·월별 흐름" : "항목별 흐름과 비중"}
            </h2>
          </div>
        </div>
        {controls}
        {tab === "summary" && granularity === "year" && (
          <div className="cash-analysis-actions">
            <button
              className="cash-action"
              aria-pressed={averageFlow}
              onClick={() => setAverageFlow(!averageFlow)}
            >
              {averageFlow ? "연간 합계로 보기" : "월평균으로 비교"}
            </button>
            <span className="cash-note">
              {averageFlow
                ? "각 연도의 포함 개월 수로 나눈 월평균"
                : "부분 연도는 포함 개월 수가 다릅니다"}
            </span>
          </div>
        )}
        <CashPlot
          periods={view.periods}
          series={
            tab === "summary"
              ? [
                  {
                    name: "수입",
                    values: view.source.map((p) =>
                      averageFlow && granularity === "year"
                        ? p.income / p.months
                        : p.income,
                    ),
                    color: "#059669",
                  },
                  {
                    name: "지출",
                    values: view.source.map((p) =>
                      averageFlow && granularity === "year"
                        ? p.expense / p.months
                        : p.expense,
                    ),
                    color: "#ef5261",
                  },
                  {
                    name: "수입 − 지출",
                    values: view.source.map((p) =>
                      averageFlow && granularity === "year"
                        ? p.saved / p.months
                        : p.saved,
                    ),
                    color: "#6366f1",
                  },
                ]
              : rows.map((r) => ({
                  name: r.name,
                  values: r.values.map((v, i) =>
                    measure === "share"
                      ? totals[i] > 0
                        ? v / totals[i]
                        : null
                      : v,
                  ),
                }))
          }
          unit={
            tab === "categories" && measure === "share" ? "percent" : "money"
          }
          onPeriod={(p) => {
            setSelected(p);
            breakdown(p);
          }}
        />
        <div className="cash-analysis-actions">
          <p className="cash-note">
            범례로 항목 켜고 끄기 · 그래프의 기간을 눌러 분류 분석
          </p>
          {tab === "categories" && (
            <div className="cash-segments">
              <button
                aria-pressed={measure === "amount"}
                onClick={() => setMeasure("amount")}
              >
                금액
              </button>
              <button
                aria-pressed={measure === "share"}
                onClick={() => setMeasure("share")}
              >
                비중
              </button>
            </div>
          )}
          <button className="cash-action" onClick={() => trend()}>
            <TrendingUp size={16} />
            전체 항목 비교
          </button>
        </div>
      </section>
      <section className="panel cash-composition-panel">
        <div className="section-heading">
          <div>
            <span className="cash-section-kicker">COMPOSITION</span>
            <h2>{type} 항목별 비중</h2>
          </div>
          <PeriodPicker
            periods={view.periods}
            value={period}
            onChange={setSelected}
          />
        </div>
        <Composition
          rows={subset(rows, pi)}
          total={totals[pi] || 0}
          onSelect={(r) => drill(period, r.name, type)}
        />
        <button className="cash-action" onClick={() => breakdown(period)}>
          분류·소분류 자세히 보기 <ArrowRight size={15} />
        </button>
      </section>
      {tab === "categories" && (
        <section className="panel cash-category-panel">
          <div className="section-heading">
            <h2>
              {granularity === "year" ? "연도별" : `${year}년 월별`} 분류 비교
            </h2>
            <span className="cash-note">분류명 → 소분류 · 평균 → 추이</span>
          </div>
          <div className="cash-mobile-comparison">
            <PeriodPicker
              periods={view.periods}
              value={period}
              onChange={setSelected}
              label="모바일 비교 기간"
            />
            {rows.map((r) => {
              const name = `${type}:${r.name}`,
                open = expanded.includes(name),
                amount = r.values[pi] || 0;
              return (
                <article className="cash-mobile-category" key={r.name}>
                  <div className="cash-mobile-category-head">
                    <button aria-expanded={open} onClick={() => toggle(name)}>
                      <i style={{ background: cashColor(r.name) }} />
                      <ChevronDown size={14} />
                      {r.name}
                    </button>
                    <button onClick={() => drill(period, r.name, type)}>
                      {compactMoney(amount)}
                    </button>
                  </div>
                  <div className="cash-mobile-category-flow">
                    <button
                      aria-label={`${r.name} 추이`}
                      onClick={() => trend(r)}
                    >
                      <Spark values={r.values} name={r.name} />
                      <span>추이 보기</span>
                    </button>
                    <div>
                      <strong>
                        {cashPct(totals[pi] > 0 ? amount / totals[pi] : null)}
                      </strong>
                      <small>
                        {period} {type} 비중
                      </small>
                    </div>
                  </div>
                  {open &&
                    r.children.map((c) => (
                      <div className="cash-mobile-child" key={c.name}>
                        <span>↳ {c.name}</span>
                        <button
                          onClick={() => drill(period, r.name, type, c.name)}
                        >
                          {compactMoney(c.values[pi] || 0)}
                        </button>
                        <button
                          aria-label={`${r.name} ${c.name} 추이`}
                          onClick={() => trend(r, c)}
                        >
                          <TrendingUp size={16} />
                        </button>
                      </div>
                    ))}
                </article>
              );
            })}
          </div>
          <div
            className="cash-desktop-comparison cash-table-scroll"
            role="region"
            aria-label="분류 비교 표"
            tabIndex={0}
          >
            <table className="cash-pivot">
              <thead>
                <tr>
                  <th scope="col">분류</th>
                  {view.periods.map((p) => (
                    <th scope="col" key={p}>
                      {p}
                    </th>
                  ))}
                  <th scope="col">
                    {granularity === "year" ? "연" : "월"}평균 ↗
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name = `${type}:${r.name}`,
                    open = expanded.includes(name);
                  const renderCells = (values: number[], sub?: string) =>
                    values.map((v, i) => {
                      const comparable =
                        i > 0 &&
                        (granularity === "month" ||
                          (view.source[i].months === 12 &&
                            view.source[i - 1].months === 12));
                      const rate = comparable
                        ? changeRate(v, values[i - 1])
                        : null;
                      return (
                        <td
                          key={i}
                          className={
                            type === "지출" &&
                            rate !== null &&
                            Math.abs(rate) >= 0.2
                              ? rate > 0
                                ? "cash-up"
                                : "cash-down"
                              : ""
                          }
                        >
                          <button
                            onClick={() =>
                              drill(view.periods[i], r.name, type, sub)
                            }
                          >
                            {compactMoney(v)}
                          </button>
                          {rate !== null && (
                            <small>
                              {rate > 0 ? "+" : ""}
                              {cashPct(rate)}
                            </small>
                          )}
                        </td>
                      );
                    });
                  return (
                    <CategoryGroup
                      key={name}
                      row={r}
                      open={open}
                      onToggle={() => toggle(name)}
                      renderCells={renderCells}
                      count={view.periods.length}
                      trend={(c) => trend(r, c)}
                    />
                  );
                })}
                <tr className="cash-total">
                  <th scope="row">기간별 분류 ↗</th>
                  {totals.map((v, i) => (
                    <td key={i}>
                      <button
                        aria-label={`${view.periods[i]} ${type} 분류별 비중`}
                        onClick={() => breakdown(view.periods[i])}
                      >
                        {compactMoney(v)}
                      </button>
                    </td>
                  ))}
                  <td>
                    <button onClick={() => trend()}>전체 항목 비교</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="cash-empty">이 기간에 해당하는 항목이 없습니다.</p>
          )}
        </section>
      )}
      {insight && (
        <CashInsight
          key={insight.title + insight.kind}
          insight={insight}
          onClose={() => setInsight(null)}
          drill={drill}
        />
      )}
    </div>
  );
}
function CategoryGroup({
  row,
  open,
  onToggle,
  renderCells,
  count,
  trend,
}: {
  row: CashCategory;
  open: boolean;
  onToggle: () => void;
  renderCells: (v: number[], sub?: string) => React.ReactNode;
  count: number;
  trend: (c?: CashCategory["children"][number]) => void;
}) {
  return (
    <>
      <tr>
        <th scope="row">
          <button aria-expanded={open} onClick={onToggle}>
            <i
              className="cash-color-dot"
              style={{ background: cashColor(row.name) }}
            />
            <ChevronDown size={13} />
            {row.name}
          </button>
        </th>
        {renderCells(row.values)}
        <td>
          <button aria-label={`${row.name} 추이`} onClick={() => trend()}>
            {compactMoney(row.amount / Math.max(1, count))} ↗
          </button>
        </td>
      </tr>
      {open &&
        row.children.map((c) => (
          <tr className="cash-subrow" key={c.name}>
            <th scope="row">↳ {c.name}</th>
            {renderCells(c.values, c.name)}
            <td>
              <button
                aria-label={`${row.name} ${c.name} 추이`}
                onClick={() => trend(c)}
              >
                {compactMoney(c.amount / Math.max(1, count))} ↗
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}
function Composition({
  rows,
  total,
  onSelect,
}: {
  rows: { name: string; amount: number }[];
  total: number;
  onSelect: (r: { name: string; amount: number }) => void;
}) {
  const positive = rows.filter((r) => r.amount > 0),
    positiveTotal = positive.reduce((n, r) => n + r.amount, 0);
  return (
    <>
      <div className="cash-composition-strip" aria-hidden="true">
        {positive.map((r) => (
          <span
            key={r.name}
            style={{
              width: `${(r.amount / positiveTotal) * 100}%`,
              background: cashColor(r.name),
            }}
          />
        ))}
      </div>
      <div className="cash-composition-list">
        {rows.map((r) => (
          <button key={r.name} onClick={() => onSelect(r)}>
            <i style={{ background: cashColor(r.name) }} />
            <span>{r.name}</span>
            <strong>{cashPct(total > 0 ? r.amount / total : null)}</strong>
            <small>{compactMoney(r.amount)}</small>
          </button>
        ))}
      </div>
      {rows.some((r) => r.amount < 0) && (
        <p className="cash-note">
          색상 막대는 양수 항목의 구성입니다. 비중 수치는 환불을 차감한 합계
          기준입니다.
        </p>
      )}
      {!rows.length && <p className="cash-empty">해당 기간 내역이 없습니다.</p>}
    </>
  );
}
function CashInsight({
  insight,
  onClose,
  drill,
}: {
  insight: Insight;
  onClose: () => void;
  drill: Drill;
}) {
  const [unit, setUnit] = useState<"money" | "percent">("money");
  const [open, setOpen] = useState<string[]>([]);
  if (insight.kind === "trend")
    return (
      <CashModal title={insight.title} onClose={onClose}>
        <div className="cash-segments">
          <button
            aria-pressed={unit === "money"}
            onClick={() => setUnit("money")}
          >
            금액
          </button>
          <button
            aria-pressed={unit === "percent"}
            onClick={() => setUnit("percent")}
          >
            비중
          </button>
        </div>
        <CashPlot
          periods={insight.periods}
          series={insight.series.map((s) => ({
            ...s,
            values: s.values.map((v, i) =>
              unit === "percent"
                ? insight.totals[i] > 0 && v !== null
                  ? v / insight.totals[i]
                  : null
                : v,
            ),
          }))}
          unit={unit}
        />
        <p className="cash-note">
          비중은 같은 기간 전체 {insight.type} 대비입니다. 합계가 0 이하이면 —로
          표시합니다.
        </p>
        <div className="cash-insight-values">
          {insight.periods.map((p, i) => (
            <details key={p} open={insight.series.length === 1}>
              <summary>{p}</summary>
              {insight.series.map((s) => (
                <div key={s.name}>
                  <span>
                    <i
                      className="cash-color-dot"
                      style={{ background: s.color || cashColor(s.name) }}
                    />
                    {s.name}
                  </span>
                  <strong>{cashMoney(s.values[i] || 0)}</strong>
                  <span className="cash-share">
                    {cashPct(
                      insight.totals[i] > 0 && s.values[i] !== null
                        ? s.values[i]! / insight.totals[i]
                        : null,
                    )}
                  </span>
                </div>
              ))}
              {insight.category && (
                <button
                  className="cash-action"
                  onClick={() =>
                    drill(p, insight.category, insight.type, insight.sub)
                  }
                >
                  이 기간 거래 보기
                </button>
              )}
            </details>
          ))}
        </div>
      </CashModal>
    );
  const total = insight.rows.reduce((n, r) => n + r.amount, 0),
    divisor = insight.kind === "average" ? Math.max(1, insight.months) : 1;
  return (
    <CashModal title={insight.title} onClose={onClose} drawer>
      <p className="cash-note">
        {insight.months}개월 기준 ·{" "}
        {insight.kind === "average"
          ? "항목별 월평균 = 해당 항목 금액 ÷ 선택 달력월 수"
          : "항목을 펼쳐 소분류를 비교하세요"}
      </p>
      <div className="cash-average-bars">
        {insight.rows.slice(0, 12).map((r) => (
          <button
            key={r.name}
            onClick={() => drill(insight.period, r.name, insight.type)}
          >
            <span>{r.name}</span>
            <div>
              <i
                style={{
                  width: `${(Math.max(0, r.amount) / Math.max(1, ...insight.rows.map((r) => r.amount))) * 100}%`,
                  background: cashColor(r.name),
                }}
              />
            </div>
            <strong>{compactMoney(r.amount / divisor)}</strong>
          </button>
        ))}
      </div>
      <div className="cash-breakdown-head">
        <span>분류 · 소분류</span>
        <span>{insight.kind === "average" ? "월평균" : "금액"}</span>
        <span>비중</span>
      </div>
      {insight.rows.map((r) => (
        <div className="cash-breakdown-group" key={r.name}>
          <div className="cash-breakdown-row">
            <button
              aria-expanded={open.includes(r.name)}
              onClick={() =>
                setOpen(
                  open.includes(r.name)
                    ? open.filter((n) => n !== r.name)
                    : [...open, r.name],
                )
              }
            >
              <i
                className="cash-color-dot"
                style={{ background: cashColor(r.name) }}
              />
              <ChevronDown size={13} />
              {r.name}
            </button>
            <button onClick={() => drill(insight.period, r.name, insight.type)}>
              {cashMoney(r.amount / divisor)}
              <small>
                {insight.kind === "average"
                  ? `${insight.period}년 ${compactMoney(r.amount)}`
                  : "거래 보기"}
              </small>
            </button>
            <span>{cashPct(total > 0 ? r.amount / total : null)}</span>
          </div>
          {open.includes(r.name) &&
            r.children.map((c) => (
              <div
                className="cash-breakdown-row cash-breakdown-child"
                key={c.name}
              >
                <span>↳ {c.name}</span>
                <button
                  onClick={() =>
                    drill(insight.period, r.name, insight.type, c.name)
                  }
                >
                  {cashMoney(c.amount / divisor)}
                </button>
                <span>
                  {cashPct(r.amount > 0 ? c.amount / r.amount : null)}
                  <small>분류 내</small>
                </span>
              </div>
            ))}
        </div>
      ))}
      {!insight.rows.length && (
        <p className="cash-empty">해당 기간 내역이 없습니다.</p>
      )}
    </CashModal>
  );
}
