"use client";
import { useEffect, useState } from "react";
import { Download, SlidersHorizontal, Search } from "lucide-react";
import {
  aggregateCash,
  cashMoney,
  cashSummaryMarkdown,
  type CashDashboard as Dashboard,
  type CashRow,
  type CashFile,
} from "@/lib/cash";
import { CashAnalysis } from "./cash-analysis";
import Link from "next/link";
import { CashFiles } from "./cash-files";
import {
  CashDetail,
  CashTransactions,
  type CashDetailSelection,
} from "./cash-detail";
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
    [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<CashDetailSelection | null>(null);
  const [transactions, setTransactions] = useState<{
    rows: CashRow[];
    count: number;
    income: number;
    expense: number;
  } | null>(null);
  const params = new URLSearchParams(query),
    tab = params.get("tab") || "summary";
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
    p.set("granularity", "month");
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
    asset?: string,
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
    if (!f) return;
    const p = new URLSearchParams(query);
    for (const key of [
      "page",
      "sort",
      "category",
      "type",
      "sub",
      "mode",
      "export",
      "assetMissing",
    ])
      p.delete(key);
    p.set("from", from < f.from ? f.from : from);
    p.set("to", to > f.to ? f.to : to);
    if (category) p.set("category", category);
    if (kind) p.set("type", kind);
    if (sub) p.set("sub", sub);
    if (asset !== undefined) {
      p.delete("asset");
      if (asset === "미입력") p.set("assetMissing", "true");
      else p.set("asset", asset);
    }
    setDetail({
      title: [category, sub, asset, kind, "거래 내역"]
        .filter(Boolean)
        .join(" · "),
      query: p.toString(),
    });
  }
  function toggle(key: string, value: string) {
    const selected = params.getAll(key);
    update({
      [key]: selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
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
          <p>연도·월별 변화와 항목별 비중을 살펴보세요.</p>
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
      <div className="cash-version-links">
        <span>새 분석</span>
        <Link href={demo ? "/demo?view=/cash/old" : "/cash/old"}>
          가계부(old) 바로가기 ↗
        </Link>
      </div>
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
              <details className="cash-filter-panel">
                <summary>
                  <span>기간·분석 조건</span>
                  <strong>
                    {f!.from} — {f!.to}
                  </strong>
                  <small>{f!.member || "전체 자료"}</small>
                </summary>
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
              </details>
              {(tab === "summary" || tab === "categories") && (
                <CashAnalysis data={data} tab={tab} drill={drill} />
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
                      <CashTransactions rows={transactions.rows} />
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
      {detail && (
        <CashDetail
          key={detail.query}
          selection={detail}
          onClose={() => setDetail(null)}
          demo={demo && f ? { rows: demoRows, filter: f } : undefined}
        />
      )}
    </div>
  );
}
