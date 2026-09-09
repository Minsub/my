"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  aggregateCash,
  cashMoney,
  compactMoney,
  cashPct,
  changeRate,
  cashSummaryMarkdown,
  type CashDashboard as Dashboard,
  type CashRow,
  type CashCategory,
  type CashFile,
} from "@/lib/cash";
import { CashFiles } from "./cash-files";
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Chart({
  periods,
  series,
  onPeriod,
}: {
  periods: string[];
  series: { name: string; values: number[]; color: string }[];
  onPeriod?: (period: string) => void;
}) {
  const values = series.flatMap((s) => s.values),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    span = max - min;
  const x = (i: number) => 65 + (i * 655) / Math.max(1, periods.length - 1),
    y = (v: number) => 185 - ((v - min) / span) * 155;
  return (
    <div className="cash-chart">
      <svg
        viewBox="0 0 760 235"
        role="img"
        aria-label={`${series.map((s) => s.name).join(", ")} 기간별 추이. 상세 값은 아래 기간 버튼이나 표에서 확인할 수 있습니다.`}
      >
        <text x="4" y="15">
          금액 (원)
        </text>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="65"
              x2="720"
              y1={y(min + span * v)}
              y2={y(min + span * v)}
              stroke="#e1e5e2"
            />
            <text x="0" y={y(min + span * v) + 4}>
              {compactMoney(min + span * v)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color}>
                <title>
                  {periods[i]} · {s.name} {cashMoney(v)}
                </title>
              </circle>
            ))}
          </g>
        ))}
        {periods.map(
          (p, i) =>
            (i === 0 ||
              i === periods.length - 1 ||
              i % Math.max(1, Math.ceil(periods.length / 6)) === 0) && (
              <text key={p} x={x(i)} y="214" textAnchor="middle">
                {p}
              </text>
            ),
        )}
      </svg>
      <div className="cash-chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      {onPeriod && (
        <div className="cash-chart-periods">
          {periods.map((p) => (
            <button key={p} onClick={() => onPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="cash-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cash-dialog-head">
        <h2>{title}</h2>
        <button
          autoFocus
          className="icon-button"
          onClick={onClose}
          aria-label="차트 닫기"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const demoRows: CashRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  date: `2026-${String(Math.floor(i / 2) + 1).padStart(2, "0")}-15`,
  member: "샘플",
  type: i % 2 ? "지출" : "수입",
  category: i % 2 ? "식비" : "급여",
  subCategory: i % 2 ? "식사" : "",
  memo: "샘플 기록",
  asset: "샘플 계좌",
  amount: i % 2 ? 1200000 + i * 10000 : 3000000,
  currency: "KRW",
  originalAmount: null,
}));
function sample(params: URLSearchParams) {
  const metadata = {
    rows: 12,
    incomeRows: 6,
    expenseRows: 6,
    otherRows: 0,
    negativeRows: 0,
    zeroRows: 0,
    firstDate: "2026-01-15",
    lastDate: "2026-06-15",
    income: 18000000,
    expense: 7560000,
    sheets: 1,
  };
  const files: CashFile[] = [
    {
      id: "sample",
      filename: "샘플.xlsx",
      version: 1,
      content_hash: "sample",
      bytes: 1000,
      metadata,
      updated_at: "2026-06-16T00:00:00Z",
      canEdit: false,
    },
  ];
  return aggregateCash(
    demoRows,
    files,
    {
      from: params.get("from") || "2026-01",
      to: params.get("to") || "2026-06",
      member: params.get("member") || "",
      q: params.get("q") || "",
      excludeLarge: params.get("large") === "true",
      expandOther: params.get("other") === "true",
      includeIncome: params.getAll("income"),
      excludeExpense: params.getAll("expense"),
      asset: params.get("asset") || "",
    },
    params.get("granularity") === "month" ? "month" : "year",
  );
}
export function CashDashboard({
  initialQuery,
  demo = false,
}: {
  initialQuery: Record<string, string>;
  demo?: boolean;
}) {
  const [query, setQuery] = useState(
      () =>
        initialQuery.cashQuery ?? new URLSearchParams(initialQuery).toString(),
    ),
    [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [expanded, setExpanded] = useState<string[]>([]),
    [chart, setChart] = useState<{
      title: string;
      periods: string[];
      series: { name: string; values: number[]; color: string }[];
    } | null>(null);
  const [transactions, setTransactions] = useState<{
    rows: CashRow[];
    count: number;
    income: number;
    expense: number;
  } | null>(null);
  const params = new URLSearchParams(query),
    tab = params.get("tab") || "summary",
    type = params.get("type") || "지출",
    granularity = params.get("granularity") || "year";
  function update(changes: Record<string, string | string[]>) {
    const p = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) {
      p.delete(key);
      if (Array.isArray(value)) value.forEach((v) => p.append(key, v));
      else if (value) p.set(key, value);
    }
    if (!("page" in changes)) p.delete("page");
    setQuery(p.toString());
    const url = new URL(window.location.href);
    url.search = p.toString();
    if (demo) url.searchParams.set("view", "/cash");
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const p = new URLSearchParams(query);
    async function load() {
      setLoading(true);
      setError("");
      try {
        let d: Dashboard;
        if (demo) d = sample(p);
        else {
          const filesOnly = p.get("tab") === "files";
          const r = await fetch(
            filesOnly ? "/api/cash/files" : `/api/cash?${p}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );
          const body = await r.json();
          if (!r.ok)
            throw Error(body.error?.message || "데이터를 읽지 못했습니다.");
          d = filesOnly
            ? aggregateCash(
                [],
                body.files,
                sample(new URLSearchParams()).filter,
                "year",
              )
            : body;
        }
        if (!active) return;
        setData(d);
        if (p.get("tab") === "transactions") {
          if (demo) {
            const { filteredCash } = await import("@/lib/cash");
            let rows = filteredCash(demoRows, d.filter);
            if (p.get("type"))
              rows = rows.filter((r) => r.type === p.get("type"));
            if (p.get("category"))
              rows = rows.filter((r) => r.category === p.get("category"));
            setTransactions({
              rows,
              count: rows.length,
              income: rows
                .filter((r) => r.type === "수입")
                .reduce((s, r) => s + r.amount, 0),
              expense: rows
                .filter((r) => r.type === "지출")
                .reduce((s, r) => s + r.amount, 0),
            });
          } else {
            p.set("mode", "transactions");
            const r = await fetch(`/api/cash?${p}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            const body = await r.json();
            if (!r.ok)
              throw Error(body.error?.message || "내역을 읽지 못했습니다.");
            if (active) setTransactions(body);
          }
        }
      } catch (e) {
        if (active && (e as Error).name !== "AbortError")
          setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, revision, demo]);
  const f = data?.filter;
  function drill(
    period?: string,
    category?: string,
    kind?: string,
    sub?: string,
  ) {
    const from = period
        ? period.length === 4
          ? `${period}-01`
          : period
        : f?.from || "",
      to = period
        ? period.length === 4
          ? `${period}-12`
          : period
        : f?.to || "";
    update({
      tab: "transactions",
      from: from < f!.from ? f!.from : from,
      to: to > f!.to ? f!.to : to,
      category: category || "",
      type: kind || "",
      sub: sub || "",
    });
    setChart(null);
  }
  function toggle(key: string, value: string) {
    const selected = params.getAll(key);
    update({
      [key]: selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    });
  }
  const categories = type === "수입" ? data?.income : data?.expense;
  function trend(row: CashCategory) {
    setChart({
      title: `${row.name} 추이`,
      periods: data!.periods,
      series: [{ name: row.name, values: row.values, color: "#496b5b" }],
    });
  }
  return (
    <div className="cash-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">CASH / OVERVIEW</span>
          <h1>
            가계부<span className="heading-dot">.</span>
          </h1>
          <p>엑셀을 올리고, 돈의 흐름을 살펴보세요.</p>
        </div>
        <button
          className="button secondary"
          disabled={!data || loading || !!error}
          onClick={() =>
            data &&
            download(
              cashSummaryMarkdown(data),
              `mono-cash-${new Date().toISOString().slice(0, 10)}.md`,
            )
          }
        >
          <Download size={15} />
          요약 내보내기
        </button>
      </header>
      <nav className="section-tabs cash-tabs" aria-label="가계부 메뉴">
        {[
          ["summary", "요약"],
          ["categories", "분류 분석"],
          ["transactions", "거래 내역"],
          ["files", "파일 관리"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "selected" : ""}
            onClick={() => update({ tab: value })}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="cash-error">
          {error}{" "}
          <button onClick={() => setRevision((r) => r + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="cash-loading">
          데이터를 불러오고 있습니다…
        </p>
      )}
      {!data && !loading && !error && <p>데이터가 없습니다.</p>}
      {data && (
        <div aria-busy={loading} className={loading ? "cash-refreshing" : ""}>
          {tab === "files" ? (
            <CashFiles
              files={data.files}
              demo={demo}
              onSaved={() => setRevision((r) => r + 1)}
            />
          ) : !data.files.length ? (
            <div className="empty-state">
              <h2>첫 가계부를 연결하세요</h2>
              <p>가계부 앱에서 내보낸 엑셀을 올리면 분석을 시작합니다.</p>
              <button
                className="button primary"
                onClick={() => update({ tab: "files" })}
              >
                파일 업로드
              </button>
            </div>
          ) : (
            <>
              <div className="cash-filters">
                <label>
                  자료
                  <select
                    aria-label="가계부 자료"
                    value={f!.member}
                    onChange={(e) => update({ member: e.target.value })}
                  >
                    <option value="">전체</option>
                    {data.options.members.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  시작 월
                  <input
                    type="month"
                    aria-label="시작 월"
                    value={params.get("from") || f!.from}
                    onChange={(e) => update({ from: e.target.value })}
                  />
                </label>
                <span className="cash-range-dash">—</span>
                <label>
                  종료 월
                  <input
                    type="month"
                    aria-label="종료 월"
                    value={params.get("to") || f!.to}
                    onChange={(e) => update({ to: e.target.value })}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={() =>
                    update({
                      from: data.options.firstMonth,
                      to: data.options.lastMonth,
                    })
                  }
                >
                  전체 기간
                </button>
                <button
                  className="cash-link"
                  onClick={() => {
                    setQuery(new URLSearchParams({ tab }).toString());
                    const url = new URL(window.location.href);
                    url.search = new URLSearchParams(
                      demo ? { view: "/cash", tab } : { tab },
                    ).toString();
                    window.history.replaceState(null, "", url);
                  }}
                >
                  초기화
                </button>
              </div>
              <details className="cash-advanced">
                <summary>
                  <SlidersHorizontal size={15} />
                  분석 조건{" "}
                  <span>
                    {f!.includeIncome.length +
                      f!.excludeExpense.length +
                      Number(f!.excludeLarge) +
                      Number(f!.expandOther) +
                      (f!.asset ? 1 : 0)}
                    개 적용
                  </span>
                </summary>
                <div className="cash-advanced-body">
                  <div className="cash-option-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={f!.excludeLarge}
                        onChange={(e) =>
                          update({ large: String(e.target.checked) })
                        }
                      />
                      1,000만원 이상 지출 제외
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={f!.expandOther}
                        onChange={(e) =>
                          update({ other: String(e.target.checked) })
                        }
                      />
                      기타를 내용별로 펼치기
                    </label>
                    <label>
                      결제수단
                      <select
                        aria-label="결제수단 필터"
                        value={f!.asset}
                        onChange={(e) => update({ asset: e.target.value })}
                      >
                        <option value="">전체</option>
                        {data.options.assets.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <fieldset>
                    <legend>
                      수입 분류 포함 <small>선택하지 않으면 전체</small>
                    </legend>
                    <div className="cash-chips">
                      {data.options.income.map((x) => (
                        <button
                          key={x}
                          aria-pressed={f!.includeIncome.includes(x)}
                          onClick={() => toggle("income", x)}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>지출 분류 제외</legend>
                    <div className="cash-chips cash-exclude">
                      {data.options.expense.map((x) => (
                        <button
                          key={x}
                          aria-pressed={f!.excludeExpense.includes(x)}
                          onClick={() => toggle("expense", x)}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </details>
              <details className="cash-coverage">
                <summary>
                  파일별 마지막 기록일{" "}
                  {data.coverage
                    .map((x) => x.lastDate.slice(0, 7))
                    .some((x) => x !== data.coverage[0]?.lastDate.slice(0, 7))
                    ? "· 자료의 반영 기간이 다릅니다"
                    : ""}
                </summary>
                <p>
                  {data.coverage
                    .map((x) => `${x.member} ${x.lastDate}`)
                    .join(" · ")}
                </p>
                <p>
                  마지막 거래일은 기록 완료일을 의미하지 않습니다. 선택 기간의
                  무거래 월도 평균에 포함됩니다.
                </p>
              </details>
              {tab === "summary" && (
                <>
                  <div className="cash-kpis">
                    {[
                      ["수입", data.total.income, "수입"],
                      ["지출", data.total.expense, "지출"],
                      ["수입 − 지출", data.total.saved, ""],
                      ["월평균 지출", data.total.averageExpense, "지출"],
                    ].map(([label, value, kind]) => (
                      <button
                        className="panel"
                        key={label}
                        onClick={() =>
                          drill(undefined, undefined, String(kind))
                        }
                      >
                        <span>
                          {label}
                          <ArrowUpRight size={14} />
                        </span>
                        <strong title={cashMoney(Number(value))}>
                          {compactMoney(Number(value))}
                        </strong>
                        <small>
                          {label === "월평균 지출"
                            ? `${data.total.months}개월 기준`
                            : label === "수입 − 지출"
                              ? `저축률 ${cashPct(data.total.savingRate)}`
                              : "선택 기간 합계"}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="cash-overview-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>월별 흐름</h2>
                        <span className="muted small">
                          선택 기간 중 최근 24개월
                        </span>
                      </div>
                      <Chart
                        periods={data.months.slice(-24).map((m) => m.period)}
                        series={[
                          {
                            name: "수입",
                            values: data.months.slice(-24).map((m) => m.income),
                            color: "#496b5b",
                          },
                          {
                            name: "지출",
                            values: data.months
                              .slice(-24)
                              .map((m) => m.expense),
                            color: "#b57b60",
                          },
                        ]}
                        onPeriod={(p) => drill(p)}
                      />
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>지출 분류</h2>
                        <button
                          className="cash-link"
                          onClick={() =>
                            update({ tab: "categories", type: "지출" })
                          }
                        >
                          전체 보기
                        </button>
                      </div>
                      <div className="cash-ranking">
                        {data.expense.slice(0, 7).map((r) => (
                          <button
                            key={r.name}
                            onClick={() => drill(undefined, r.name, "지출")}
                          >
                            <span>{r.name}</span>
                            <strong>{compactMoney(r.amount)}</strong>
                            <i
                              style={{
                                width: `${(Math.max(0, r.amount) / Math.max(1, ...data.expense.map((x) => x.amount))) * 100}%`,
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>연도별 요약</h2>
                    </div>
                    <div className="cash-year-grid">
                      {data.years.map((y) => (
                        <button
                          key={y.period}
                          className="cash-year"
                          onClick={() => drill(y.period)}
                        >
                          <strong>
                            {y.period}
                            <small>{y.months}개월</small>
                          </strong>
                          <dl>
                            <div>
                              <dt>수입</dt>
                              <dd>{compactMoney(y.income)}</dd>
                            </div>
                            <div>
                              <dt>지출</dt>
                              <dd>{compactMoney(y.expense)}</dd>
                            </div>
                            <div>
                              <dt>수입 − 지출</dt>
                              <dd>{compactMoney(y.saved)}</dd>
                            </div>
                            <div>
                              <dt>월평균 지출</dt>
                              <dd>{compactMoney(y.averageExpense)}</dd>
                            </div>
                          </dl>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>결제수단별 지출</h2>
                    </div>
                    <div className="cash-asset-grid">
                      {data.assets.slice(0, 12).map((a) => (
                        <button
                          key={a.name}
                          onClick={() =>
                            update({
                              tab: "transactions",
                              asset: a.name === "미입력" ? "" : a.name,
                              type: "지출",
                            })
                          }
                        >
                          <span>{a.name}</span>
                          <strong>{compactMoney(a.amount)}</strong>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {tab === "categories" && (
                <section className="panel">
                  <div className="cash-analysis-toolbar">
                    <div className="filter-chips">
                      {["지출", "수입"].map((t) => (
                        <button
                          key={t}
                          className={type === t ? "active" : ""}
                          onClick={() => update({ type: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label>
                      기간 단위
                      <select
                        aria-label="분류 기간 단위"
                        value={granularity}
                        onChange={(e) =>
                          update({ granularity: e.target.value })
                        }
                      >
                        <option value="year">연도별</option>
                        <option value="month">월별</option>
                      </select>
                    </label>
                    <button
                      className="cash-link"
                      onClick={() =>
                        setChart({
                          title: `${type} 전체 추이`,
                          periods: data.periods,
                          series: [
                            {
                              name: type,
                              values: data.periods.map((_, i) =>
                                categories!.reduce(
                                  (n, r) => n + r.values[i],
                                  0,
                                ),
                              ),
                              color: "#496b5b",
                            },
                          ],
                        })
                      }
                    >
                      전체 추이
                    </button>
                  </div>
                  <p className="muted small">
                    금액을 누르면 해당 거래로 이동합니다. 월평균은 선택 기간{" "}
                    {data.total.months}개월 기준입니다. 증감은 직전 열과
                    비교하며, 부분 연도 간 증감은 표시하지 않습니다.
                  </p>
                  <div className="cash-category-mobile">
                    {categories!.map((r) => (
                      <div key={r.name} className="cash-category-item">
                        <button
                          onClick={() =>
                            setExpanded((e) =>
                              e.includes(r.name)
                                ? e.filter((x) => x !== r.name)
                                : [...e, r.name],
                            )
                          }
                        >
                          <ChevronDown size={15} />
                          <strong>{r.name}</strong>
                          <span>{compactMoney(r.amount)}</span>
                        </button>
                        <div className="cash-category-actions">
                          <button
                            className="cash-link"
                            onClick={() => trend(r)}
                          >
                            추이 보기
                          </button>
                          <button
                            className="cash-link"
                            onClick={() => drill(undefined, r.name, type)}
                          >
                            거래 {r.count}건
                          </button>
                          <span>
                            월평균 {compactMoney(r.amount / data.total.months)}
                          </span>
                        </div>
                        {expanded.includes(r.name) &&
                          r.children.map((c) => (
                            <button
                              className="cash-child"
                              key={c.name}
                              onClick={() =>
                                drill(undefined, r.name, type, c.name)
                              }
                            >
                              <span>{c.name}</span>
                              <strong>{compactMoney(c.amount)}</strong>
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
                  <div className="cash-pivot">
                    <table>
                      <thead>
                        <tr>
                          <th>분류</th>
                          {data.periods.map((p) => (
                            <th key={p}>{p}</th>
                          ))}
                          <th>합계</th>
                          <th>월평균</th>
                          <th>추이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories!.map((r) => (
                          <CategoryRows
                            key={r.name}
                            row={r}
                            periods={data.periods}
                            type={type}
                            months={data.total.months}
                            yearMonths={data.years.map((y) => y.months)}
                            open={expanded.includes(r.name)}
                            onToggle={() =>
                              setExpanded((e) =>
                                e.includes(r.name)
                                  ? e.filter((x) => x !== r.name)
                                  : [...e, r.name],
                              )
                            }
                            onTrend={() => trend(r)}
                            drill={drill}
                          />
                        ))}
                        <tr className="cash-total">
                          <th>합계</th>
                          {data.periods.map((p, i) => (
                            <td key={p}>
                              <button onClick={() => drill(p, undefined, type)}>
                                {compactMoney(
                                  categories!.reduce(
                                    (n, r) => n + r.values[i],
                                    0,
                                  ),
                                )}
                              </button>
                            </td>
                          ))}
                          <td>
                            <button
                              onClick={() => drill(undefined, undefined, type)}
                            >
                              {compactMoney(
                                categories!.reduce((n, r) => n + r.amount, 0),
                              )}
                            </button>
                          </td>
                          <td>
                            {compactMoney(
                              categories!.reduce((n, r) => n + r.amount, 0) /
                                data.total.months,
                            )}
                          </td>
                          <td>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {!categories!.length && (
                    <p className="cash-empty">조건에 맞는 내역이 없습니다.</p>
                  )}
                </section>
              )}
              {tab === "transactions" && (
                <section className="panel">
                  <div className="cash-transaction-toolbar">
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="거래 검색"
                        placeholder="내용, 분류, 결제수단 검색"
                        value={params.get("q") || ""}
                        onChange={(e) => update({ q: e.target.value })}
                      />
                    </label>
                    <select
                      aria-label="거래 유형"
                      value={params.get("type") || ""}
                      onChange={(e) =>
                        update({ type: e.target.value, category: "", sub: "" })
                      }
                    >
                      <option value="">수입·지출</option>
                      <option>수입</option>
                      <option>지출</option>
                    </select>
                    <select
                      aria-label="거래 정렬"
                      value={params.get("sort") || "date-desc"}
                      onChange={(e) => update({ sort: e.target.value })}
                    >
                      <option value="date-desc">날짜 최신순</option>
                      <option value="amount-desc">금액 높은순</option>
                      <option value="amount-asc">금액 낮은순</option>
                    </select>
                    {!demo && (
                      <a
                        className="button secondary"
                        href={`/api/cash?${new URLSearchParams(query)}&mode=transactions&export=csv`}
                      >
                        <Download size={14} />
                        CSV
                      </a>
                    )}
                  </div>
                  {params.get("category") && (
                    <p>
                      분류: {params.get("category")}{" "}
                      {params.get("sub") && `/ ${params.get("sub")}`}{" "}
                      <button
                        className="cash-link"
                        onClick={() => update({ category: "", sub: "" })}
                      >
                        분류 해제
                      </button>
                    </p>
                  )}
                  {transactions && (
                    <>
                      <p className="cash-result-count">
                        {transactions.count.toLocaleString()}건 · 수입{" "}
                        {cashMoney(transactions.income)} · 지출{" "}
                        {cashMoney(transactions.expense)}
                      </p>
                      <div className="cash-transactions">
                        {transactions.rows.map((r) => (
                          <article className="cash-transaction" key={r.id}>
                            <time>{r.date}</time>
                            <div>
                              <strong>{r.memo || r.category}</strong>
                              <p>
                                {r.member} · {r.category}
                                {r.subCategory && ` / ${r.subCategory}`} ·{" "}
                                {r.asset || "결제수단 미입력"}
                              </p>
                              {r.currency !== "KRW" && (
                                <small>
                                  원본 {r.originalAmount?.toLocaleString()}{" "}
                                  {r.currency}
                                </small>
                              )}
                            </div>
                            <span
                              className={r.type === "수입" ? "cash-income" : ""}
                            >
                              <small>{r.type}</small>
                              <strong>{cashMoney(r.amount)}</strong>
                            </span>
                          </article>
                        ))}
                      </div>
                      {!transactions.rows.length && (
                        <p className="cash-empty">
                          조건에 맞는 거래가 없습니다.
                        </p>
                      )}
                      <div className="cash-pagination">
                        <button
                          className="button secondary"
                          disabled={
                            Number(params.get("page") || 1) <= 1 || loading
                          }
                          onClick={() =>
                            update({
                              page: String(Number(params.get("page") || 1) - 1),
                            })
                          }
                        >
                          이전
                        </button>
                        <span>
                          {params.get("page") || 1} /{" "}
                          {Math.max(1, Math.ceil(transactions.count / 50))}
                        </span>
                        <button
                          className="button secondary"
                          disabled={
                            Number(params.get("page") || 1) * 50 >=
                              transactions.count || loading
                          }
                          onClick={() =>
                            update({
                              page: String(Number(params.get("page") || 1) + 1),
                            })
                          }
                        >
                          다음
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
              <p className="cash-footnote">
                수입·지출만 분석하며 이체·차액, 선물 / 계좌이체 지출은
                제외합니다. 음수는 차감하며 수입−지출은 계좌 잔액이 아닙니다.
                원본 전체는 파일 관리에서 내려받을 수 있습니다.
              </p>
            </>
          )}
        </div>
      )}
      {chart && (
        <Modal title={chart.title} onClose={() => setChart(null)}>
          <Chart periods={chart.periods} series={chart.series} />
          <div className="cash-chart-values">
            {chart.periods.map((p, i) => (
              <div key={p}>
                <span>{p}</span>
                {chart.series.map((s) => (
                  <strong key={s.name}>{cashMoney(s.values[i])}</strong>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function CategoryRows({
  row: r,
  periods,
  type,
  months,
  yearMonths,
  open,
  onToggle,
  onTrend,
  drill,
}: {
  row: CashCategory;
  periods: string[];
  type: string;
  months: number;
  yearMonths: number[];
  open: boolean;
  onToggle: () => void;
  onTrend: () => void;
  drill: (
    period?: string,
    category?: string,
    type?: string,
    sub?: string,
  ) => void;
}) {
  return (
    <>
      <tr>
        <th>
          <button onClick={onToggle} aria-expanded={open}>
            <ChevronDown size={13} />
            {r.name}
          </button>
        </th>
        {r.values.map((v, i) => {
          const comparable =
            i > 0 &&
            (periods[i].length !== 4 ||
              (yearMonths[i] === 12 && yearMonths[i - 1] === 12));
          const rate = comparable ? changeRate(v, r.values[i - 1]) : null;
          return (
            <td
              key={i}
              className={
                type === "지출" && rate !== null && Math.abs(rate) >= 0.2
                  ? rate > 0
                    ? "cash-up"
                    : "cash-down"
                  : ""
              }
            >
              <button
                title={cashMoney(v)}
                onClick={() => drill(periods[i], r.name, type)}
              >
                {compactMoney(v)}
              </button>
              {type === "지출" && rate !== null && (
                <small>
                  {rate > 0 ? "+" : ""}
                  {cashPct(rate)}
                </small>
              )}
            </td>
          );
        })}
        <td>
          <button onClick={() => drill(undefined, r.name, type)}>
            {compactMoney(r.amount)}
          </button>
        </td>
        <td>
          <button onClick={onTrend}>{compactMoney(r.amount / months)}</button>
        </td>
        <td>
          <button onClick={onTrend} aria-label={`${r.name} 추이`}>
            ↗
          </button>
        </td>
      </tr>
      {open &&
        r.children.map((c) => (
          <tr className="cash-subrow" key={c.name}>
            <th>{c.name}</th>
            {c.values.map((v, i) => (
              <td key={i}>
                <button onClick={() => drill(periods[i], r.name, type, c.name)}>
                  {compactMoney(v)}
                </button>
              </td>
            ))}
            <td>
              <button onClick={() => drill(undefined, r.name, type, c.name)}>
                {compactMoney(c.amount)}
              </button>
            </td>
            <td>{compactMoney(c.amount / months)}</td>
            <td />
          </tr>
        ))}
    </>
  );
}
