"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  TriangleAlert,
  ArrowUpRight,
  ChevronRight,
  LineChart,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  assetAxes,
  assetChangeRate,
  assetCompact,
  assetMoney,
  assetPct,
  assetSignedMoney,
  assetSignedPct,
  assetRanges,
  assetTimelineSeries,
  findAssetGroup,
  periodLabel,
  type AssetAxis,
  type AssetPeriod,
  type AssetRange,
  type AssetRisk,
  type AssetStockBoard,
  type AssetSummary,
} from "@/lib/assets";
import type { AssetOverview } from "@/server/assets";
import { AssetLine, AssetPie, AssetTrend, assetColor } from "./asset-chart";
import { AssetDetail, type AssetDetailTarget } from "./asset-detail";
import { AssetUpload } from "./asset-upload";
import { RecordForm, type FormSpec } from "./record-form";
import type { Operation } from "@/lib/contracts";
import { demoAssetOverview, demoAssetItems } from "@/lib/demo-assets";

const periods: { key: AssetPeriod; label: string }[] = [
  { key: "month", label: "월별" },
  { key: "year", label: "연별" },
];
const chartAxes = assetAxes.filter(
  (a) => a.key === "group" || a.key === "parent",
);
// 표의 합계 행은 축의 묶음이 아니므로 그룹 key와 겹치지 않는 이름을 쓴다.
const TOTAL_KEY = "__total__";

export function AssetStatus({
  initialQuery,
  demo = false,
  href = (p: string) => p,
}: {
  initialQuery: Record<string, string>;
  demo?: boolean;
  href?: (path: string) => string;
}) {
  const [query, setQuery] = useState(
    () =>
      initialQuery.assetQuery ?? new URLSearchParams(initialQuery).toString(),
  );
  const [data, setData] = useState<AssetOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<AssetDetailTarget | null>(null);
  const [trend, setTrend] = useState<string | null>(null);
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const params = new URLSearchParams(query);
  const owner = params.get("owner") || "all";
  const period = (params.get("period") as AssetPeriod) || "month";
  const axis = (params.get("axis") as AssetAxis) || "group";
  const range = (params.get("range") as AssetRange) || "1y";
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setQuery(next.toString());
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.search = next.toString();
      window.history.replaceState(null, "", url);
    }
  }
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        let body: AssetOverview;
        const q = new URLSearchParams(query);
        if (!q.get("range")) q.set("range", "1y");
        if (demo) body = demoAssetOverview(q);
        else {
          const r = await fetch(`/api/assets?${q}`, { cache: "no-store" });
          const parsed = await r.json();
          if (!r.ok)
            throw Error(parsed.error?.message ?? "불러오지 못했습니다.");
          body = parsed as AssetOverview;
        }
        if (!live) return;
        setData(body);
        setError("");
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [query, revision, demo]);
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 5000);
  };
  async function save(operation: Operation, input: Record<string, unknown>) {
    if (demo)
      throw Error(
        "둘러보기 화면에서는 저장하지 않습니다. 로그인 후 이용해주세요.",
      );
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, input }),
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
    setRevision((n) => n + 1);
    inform("자산 기록을 저장했습니다.");
  }
  const open = (spec: FormSpec) => {
    if (demo) {
      inform("둘러보기 화면입니다. 로그인하면 기록을 저장할 수 있어요.");
      return;
    }
    setForm(spec);
  };
  const ownerForm = () =>
    open({
      title: "자산 소유자 추가",
      description:
        "자산현황에 표시할 이름입니다. 로그인 계정이 없는 구성원도 등록할 수 있습니다.",
      operation: "asset_save_owner",
      fields: [{ name: "name", label: "이름", required: true }],
    });
  // 자산 목록은 수십 줄이라 화면에서 한 칸씩 넣을 것이 아니다. CSV 한 장을 올린다.
  // 둘러보기에서도 창은 연다. CSV 규격을 보여주는 것이 이 화면의 설명이고,
  // 저장은 save()가 막으므로 창 안에서 그 이유를 읽는 편이 낫다.
  const openUpload = () => setUpload(true);
  const activeOwners = data?.owners.filter((o) => o.active) ?? [];
  // 머리말 버튼은 오류·로딩 화면에도 그대로 나온다. 그 화면에서 눌러도 창이 떠야 하므로
  // 모달과 토스트는 모든 반환 경로에 함께 붙인다.
  const overlays = (
    <>
      {detail && (
        <AssetDetail
          target={detail}
          owner={owner}
          period={period}
          demo={demo}
          demoItems={demoAssetItems}
          onClose={() => setDetail(null)}
        />
      )}
      {form && (
        <RecordForm spec={form} onClose={() => setForm(null)} onSave={save} />
      )}
      {upload && (
        <AssetUpload
          owners={activeOwners}
          defaultOwner={
            owner !== "all" && activeOwners.some((o) => o.id === owner)
              ? owner
              : (activeOwners[0]?.id ?? "")
          }
          onClose={() => setUpload(false)}
          onSave={save}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
  const heading = (
    <div className="page-heading">
      <div>
        <span className="eyebrow">ASSETS / STATUS</span>
        <h1>
          자산현황<span className="heading-dot">.</span>
        </h1>
        <p>구성원별 자산을 그룹으로 나눠 기간별로 비교합니다.</p>
      </div>
      <div className="button-row">
        <Link className="button secondary" href={href("/assets/records")}>
          기록 이력 <ArrowUpRight size={15} />
        </Link>
        <button className="button secondary" onClick={ownerForm}>
          소유자 추가
        </button>
        <button
          className="button primary add-button"
          onClick={() => (activeOwners.length ? openUpload() : ownerForm())}
        >
          <Upload size={17} />
          <span>자산 기록</span>
        </button>
      </div>
    </div>
  );
  // 소유자 칩은 데이터가 없어도 항상 그린다. 기록 없는 사람을 고른 뒤 돌아오지 못하면 안 된다.
  const ownerChips = data && (
    <div className="asset-filters">
      <div className="asset-chips" role="group" aria-label="구성원">
        <button
          className={owner === "all" ? "selected" : ""}
          onClick={() => update({ owner: "" })}
        >
          종합
        </button>
        {activeOwners.map((o) => (
          <button
            key={o.id}
            className={owner === o.id ? "selected" : ""}
            onClick={() => update({ owner: o.id })}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div
        className="asset-chips asset-filter-range"
        role="group"
        aria-label="기간 범위"
      >
        {assetRanges.map((r) => (
          <button
            key={r.key}
            className={range === r.key ? "selected" : ""}
            onClick={() => update({ range: r.key })}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
  if (error)
    return (
      <div className="asset-page">
        {heading}
        <div className="panel asset-error">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={15} /> 다시 시도
          </button>
        </div>
        {overlays}
      </div>
    );
  if (loading || !data)
    return (
      <div className="asset-page">
        {heading}
        <p className="muted">불러오는 중입니다…</p>
        {overlays}
      </div>
    );
  const summary = data.summaries[axis];
  const groupSummary = data.summaries.group;
  // CAGR은 기록이 있는 기간만 쓴다. 증감액도 같은 구간의 처음과 끝으로 맞춘다.
  const withData = data.timelines.group.filter((p) => p.total > 0);
  const spanChange =
    withData.length > 1 ? withData.at(-1)!.total - withData[0].total : null;
  const timeline = data.timelines[axis];
  const series = assetTimelineSeries(timeline);
  const points = timeline.map((p) => p.period);
  const mix = data.currencyMix;
  const mixTotal = mix.KRW + mix.USD + mix.NONE;
  const ownerSum = data.ownerTotals.reduce((n, o) => n + o.total, 0);
  const drill = (at: string, bucket: string) => {
    const label =
      timeline
        .find((p) => p.period === at)
        ?.buckets.find((b) => b.key === bucket)?.name ?? bucket;
    setDetail({ at, axis, bucket, label });
  };
  // 위험·안전 박스는 화면의 분류 기준과 무관하게 항상 자산 그룹으로 연다.
  const drillGroup = (bucket: string, label: string) =>
    groupSummary &&
    setDetail({ at: groupSummary.period, axis: "group", bucket, label });
  const stockBoard = (key: string | null) =>
    data.stocks.find((b) => b.key === key && b.count > 0);
  const openStock = stockBoard(stockKey);
  const trendSeries =
    trend === TOTAL_KEY
      ? { key: TOTAL_KEY, name: "합계", values: timeline.map((p) => p.total) }
      : series.find((s) => s.key === trend);
  return (
    <div className="asset-page">
      {heading}
      {!activeOwners.length ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Plus size={30} />
          </div>
          <h3>자산 소유자를 먼저 등록해주세요</h3>
          <p>
            자산현황은 소유자별로 기록합니다. 이름을 추가하면 기록할 수 있어요.
          </p>
          <button className="button primary" onClick={ownerForm}>
            소유자 추가
          </button>
        </div>
      ) : (
        <>
          {ownerChips}
          {!groupSummary ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Plus size={30} />
              </div>
              <h3>이 구성원의 자산 기록이 없습니다</h3>
              <p>
                위에서 다른 구성원을 고르거나, 이 구성원의 자산을 기록해보세요.
              </p>
              <button className="button primary" onClick={openUpload}>
                자산 기록
              </button>
            </div>
          ) : (
            <>
              {data.unclassified > 0 && (
                <div className="asset-warning" role="status">
                  <TriangleAlert size={17} />
                  <span>
                    미분류 자산 {assetMoney(data.unclassified)}이 있습니다. 어느
                    그룹인지 확인하고 다시 기록해주세요.
                  </span>
                </div>
              )}
              {/* 총자산을 왼쪽 큰 카드로 두고 나머지 둘을 오른쪽에 쌓는다. 세 칸을 같은 폭으로 두면
                  구성원 내역이 있는 총자산만 길어지고 옆 두 칸이 비어 보인다. */}
              <section className="asset-kpis" aria-label="자산 요약">
                <div className="asset-kpi asset-kpi-total">
                  <span className="asset-kpi-label">
                    총자산 · {periodLabel(groupSummary.period)} 기준
                  </span>
                  <strong className="asset-kpi-value">
                    {assetMoney(groupSummary.total)}
                  </strong>
                  <p className="asset-kpi-sub">
                    {groupSummary.change === null ? (
                      "직전 비교 없음"
                    ) : (
                      <>
                        직전 대비{" "}
                        <b className={changeTone(groupSummary.change)}>
                          {assetSignedMoney(groupSummary.change)} (
                          {assetSignedPct(groupSummary.change_rate)})
                        </b>
                      </>
                    )}
                  </p>
                  {/* 남는 높이는 추이 선이 채운다. 구성원 한 명일 때도 카드가 비지 않는다. */}
                  <AssetSparkline
                    periods={withData.map((p) => p.period)}
                    values={withData.map((p) => p.total)}
                  />
                  {/* 구성원이 한 명이면 총자산과 같은 값이라 적지 않는다. */}
                  {data.ownerTotals.length > 1 && (
                    <ul className="asset-kpi-owners">
                      {data.ownerTotals.map((o) => (
                        <li key={o.owner_id}>
                          <span>
                            {o.name}
                            <i>
                              {assetPct(
                                ownerSum > 0 ? o.total / ownerSum : null,
                              )}
                            </i>
                          </span>
                          <b>{assetCompact(o.total)}</b>
                          <small>
                            {o.as_of
                              ? `${o.as_of.replaceAll("-", ".")} 기록`
                              : "기록 없음"}
                          </small>
                          <em className={changeTone(o.change)}>
                            {o.change === null
                              ? "—"
                              : `${o.change > 0 ? "▲" : o.change < 0 ? "▼" : ""}${assetCompact(Math.abs(o.change))}`}
                          </em>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="asset-kpi">
                  <span className="asset-kpi-label">연평균 자산 증가율</span>
                  <div className="asset-kpi-row">
                    <strong
                      className={`asset-kpi-value ${data.cagr === null ? "" : data.cagr >= 0 ? "up" : "down"}`}
                    >
                      {assetSignedPct(data.cagr)}
                    </strong>
                    {/* 비율만 있으면 "그래서 얼마 늘었나"를 못 읽는다. 창 안의 실제 증감액을 같이 적는다. */}
                    {spanChange !== null && (
                      <div className="asset-kpi-fact">
                        <b className={changeTone(spanChange)}>
                          {assetSignedMoney(spanChange)}
                        </b>
                        <span>
                          {assetCompact(withData[0].total)} →{" "}
                          {assetCompact(withData.at(-1)!.total)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="asset-kpi-sub">
                    {assetRanges.find((r) => r.key === data.range)?.label} ·{" "}
                    {withData.length}개 기간 기준 CAGR
                    {spanChange !== null &&
                      ` · ${periodLabel(withData[0].period)}부터`}
                  </p>
                </div>
                <div className="asset-kpi">
                  <span className="asset-kpi-label">원화 / 달러 비율</span>
                  <div className="asset-kpi-mix">
                    {(
                      [
                        ["KRW", "원화"],
                        ["USD", "달러"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <span>
                          <i style={{ background: assetColor(key) }} />
                          {label}
                        </span>
                        <strong className="asset-kpi-value">
                          {assetPct(mixTotal > 0 ? mix[key] / mixTotal : null)}
                        </strong>
                        <small>{assetCompact(mix[key])}</small>
                      </div>
                    ))}
                  </div>
                  <div className="asset-mix-bar">
                    {(["KRW", "USD", "NONE"] as const).map((key) => (
                      <i
                        key={key}
                        style={{
                          width: `${mixTotal > 0 ? (mix[key] / mixTotal) * 100 : 0}%`,
                          background: assetColor(key),
                        }}
                      />
                    ))}
                  </div>
                  {mix.NONE > 0 && (
                    <p className="asset-kpi-sub">
                      <i
                        className="asset-dot"
                        style={{ background: assetColor("NONE") }}
                      />
                      기타 {assetCompact(mix.NONE)} ·{" "}
                      {assetPct(mix.NONE / mixTotal)}
                    </p>
                  )}
                </div>
              </section>
              <div className="asset-view-controls">
                <div
                  className="asset-chips"
                  role="group"
                  aria-label="기간 단위"
                >
                  {periods.map((p) => (
                    <button
                      key={p.key}
                      className={period === p.key ? "selected" : ""}
                      onClick={() => update({ period: p.key })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div
                  className="asset-chips"
                  role="group"
                  aria-label="분류 기준"
                >
                  {chartAxes.map((a) => (
                    <button
                      key={a.key}
                      className={axis === a.key ? "selected" : ""}
                      onClick={() => update({ axis: a.key })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <section className="panel">
                <div className="section-heading compact">
                  <h2>자산 추이</h2>
                  <span className="muted small">
                    점을 누르면 그 기간의 종목을 봅니다
                  </span>
                </div>
                <div className="asset-chart-grid">
                  <AssetTrend
                    periods={points}
                    series={series}
                    onPoint={drill}
                  />
                  <AssetPie
                    rows={summary?.rows ?? []}
                    total={summary?.total ?? 0}
                    onSlice={(key) => {
                      // 주식 두 그룹은 카드의 전체 보기와 같은 종목 팝업을 연다. 원본 항목 서랍은
                      // 계좌·구성원별로 쪼개져 있어 종목 규모와 비중을 읽기 어렵다.
                      if (axis === "group" && stockBoard(key)) setStockKey(key);
                      else if (summary) drill(summary.period, key);
                    }}
                  />
                </div>
              </section>
              {groupSummary && (
                <section className="panel">
                  <div className="section-heading compact">
                    <h2>위험 · 안전 자산</h2>
                    <span className="muted small">
                      {periodLabel(groupSummary.period)} 기준 · 세부 분류 비율은
                      각 묶음 안의 비중
                    </span>
                  </div>
                  <AssetRiskBoard summary={groupSummary} onRow={drillGroup} />
                </section>
              )}
              <section className="panel">
                <div className="section-heading compact">
                  <h2>주식 보유 현황</h2>
                  <span className="muted small">
                    {groupSummary
                      ? `${periodLabel(groupSummary.period)} 최신 기록`
                      : "최신 기록"}{" "}
                    · 금액 상위 5종목
                  </span>
                </div>
                <div className="asset-stock-grid">
                  {data.stocks.map((board) => (
                    <AssetStockCard
                      key={board.key}
                      board={board}
                      onOpen={() => setStockKey(board.key)}
                    />
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="section-heading compact">
                  <h2>기간별 금액·증감</h2>
                  <span className="muted small">
                    {period === "year" ? "연별" : "월별"} · 이름을 누르면 추이,
                    셀을 누르면 종목을 봅니다
                  </span>
                </div>
                <AssetMatrix
                  timeline={timeline}
                  series={series}
                  onCell={drill}
                  onSeries={setTrend}
                />
              </section>
            </>
          )}
        </>
      )}
      {openStock && groupSummary && (
        <AssetStockDialog
          board={openStock}
          period={periodLabel(groupSummary.period)}
          onClose={() => setStockKey(null)}
        />
      )}
      {trendSeries && (
        <AssetTrendDialog
          name={trendSeries.name}
          color={
            trendSeries.key === TOTAL_KEY
              ? "#3f4a3f"
              : assetColor(trendSeries.key)
          }
          unit={period === "year" ? "연별" : "월별"}
          periods={points}
          values={trendSeries.values}
          onClose={() => setTrend(null)}
        />
      )}
      {overlays}
    </div>
  );
}
// 증감은 색만으로 읽히면 안 된다. 화살표를 함께 붙여 색을 못 보는 화면에서도 방향이 남게 한다.
// 부호는 화살표가 이미 말하므로 금액은 절댓값으로 적는다.
const changeTone = (change: number | null) =>
  !change ? "flat" : change > 0 ? "up" : "down";
function changeText(change: number | null, rate: number | null) {
  if (change === null) return "—";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";
  const pct = rate === null ? "" : ` ${Math.abs(rate * 100).toFixed(1)}%`;
  return `${arrow}${assetCompact(Math.abs(change))}${pct}`;
}
// 한 칸에 금액과 직전 기간 대비 증감을 적는다. 비중은 위 파이·위험 박스가 이미 보여주므로 빼고,
// 표는 "얼마에서 얼마로 움직였는가" 한 가지만 읽게 한다. 합계는 기준선이므로 맨 위에 둔다.
function AssetMatrix({
  timeline,
  series,
  onCell,
  onSeries,
}: {
  timeline: AssetOverview["timelines"][AssetAxis];
  series: { key: string; name: string; values: number[] }[];
  onCell: (period: string, key: string) => void;
  onSeries: (key: string) => void;
}) {
  const rows = useMemo(
    () => [
      { key: TOTAL_KEY, name: "합계", values: timeline.map((p) => p.total) },
      ...series,
    ],
    [timeline, series],
  );
  return (
    <div className="asset-table-scroll">
      <table className="asset-table asset-matrix">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {timeline.map((p) => (
              <th scope="col" key={p.period}>
                {periodLabel(p.period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = row.key === TOTAL_KEY;
            return (
              <tr key={row.key} className={total ? "asset-total-row" : ""}>
                <th scope="row">
                  <button
                    className="asset-series-button"
                    onClick={() => onSeries(row.key)}
                    title={`${row.name} 추이 보기`}
                  >
                    <i
                      className="asset-dot"
                      style={{
                        background: total ? "#3f4a3f" : assetColor(row.key),
                      }}
                    />
                    <span>{row.name}</span>
                    <LineChart size={13} aria-hidden />
                  </button>
                </th>
                {row.values.map((value, i) => {
                  const before = i === 0 ? null : row.values[i - 1];
                  const change = before === null ? null : value - before;
                  const rate =
                    before === null ? null : assetChangeRate(value, before);
                  const figures = (
                    <>
                      <b>{assetCompact(value)}</b>
                      <em className={changeTone(change)}>
                        {changeText(change, rate)}
                      </em>
                    </>
                  );
                  return (
                    <td key={timeline[i].period}>
                      {total ? (
                        <span className="asset-cell">{figures}</span>
                      ) : (
                        <button
                          className="asset-cell"
                          onClick={() => onCell(timeline[i].period, row.key)}
                        >
                          {figures}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
// 누적 막대에서는 작은 항목의 기울기가 큰 항목에 눌린다. 한 항목만 선으로 따로 본다.
function AssetTrendDialog({
  name,
  color,
  unit,
  periods,
  values,
  onClose,
}: {
  name: string;
  color: string;
  unit: string;
  periods: string[];
  values: number[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  // dialog의 기본 취소 동작에만 기대지 않는다. 상세 서랍(asset-detail)과 같은 방식으로 직접 듣는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const last = values.at(-1) ?? 0;
  const first = values.find((v) => v > 0) ?? 0;
  const change = values.length > 1 ? last - values[0] : null;
  return (
    <dialog
      ref={dialog}
      className="record-dialog asset-trend-dialog"
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={`${name} 추이`}
    >
      <div className="asset-trend-body">
        <header>
          <div>
            <span className="eyebrow">{unit} 추이</span>
            <h2>
              <i className="asset-dot" style={{ background: color }} />
              {name}
            </h2>
            <p className="muted small">
              최근 {assetMoney(last)}
              {change !== null && (
                <>
                  {" · 기간 내 "}
                  <em className={!change ? "" : change > 0 ? "up" : "down"}>
                    {assetSignedMoney(change)} (
                    {assetSignedPct(assetChangeRate(last, first))})
                  </em>
                </>
              )}
            </p>
          </div>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <AssetLine
          periods={periods}
          name={name}
          color={color}
          values={values}
        />
      </div>
    </dialog>
  );
}
// 위험·안전은 두 덩어리의 비율이 먼저고, 그 안의 세부 분류는 각 덩어리를 분모로 본다.
// 전체 대비 비중으로 적으면 "안전 자산 안에서 예적금이 얼마인지"를 읽을 수 없다.
const riskSides: { risk: AssetRisk | null; key: string; label: string }[] = [
  { risk: "RISKY", key: "RISKY", label: "위험" },
  { risk: "SAFE", key: "SAFE", label: "안전" },
  { risk: null, key: "UNKNOWN", label: "미분류" },
];
function AssetRiskBoard({
  summary,
  onRow,
}: {
  summary: AssetSummary;
  onRow: (key: string, label: string) => void;
}) {
  const sides = riskSides
    .map((side) => {
      const rows = summary.rows
        .filter(
          (r) =>
            r.amount > 0 && (findAssetGroup(r.key)?.risk ?? null) === side.risk,
        )
        .sort((a, b) => b.amount - a.amount);
      return {
        ...side,
        rows,
        amount: rows.reduce((n, r) => n + r.amount, 0),
        // 막대는 100%가 아니라 그 묶음의 최대 항목을 가득 찬 길이로 쓴다.
        // 분류가 잘게 쪼개질수록 모든 막대가 짧아져서 서로 비교가 안 되기 때문이다.
        max: rows[0]?.amount ?? 0,
      };
    })
    .filter((side) => side.amount > 0);
  const total = summary.total;
  const share = (n: number) => (total > 0 ? n / total : null);
  return (
    <>
      <div
        className="asset-risk-track"
        role="img"
        aria-label={sides
          .map((s) => `${s.label} ${assetPct(share(s.amount))}`)
          .join(", ")}
      >
        {sides.map((side) => (
          <span
            key={side.key}
            style={{
              width: `${total > 0 ? (side.amount / total) * 100 : 0}%`,
              background: assetColor(side.key),
            }}
          >
            {side.label} {assetPct(share(side.amount))}
          </span>
        ))}
      </div>
      <div className="asset-risk-cols">
        {sides.map((side) => (
          <div className="asset-risk-col" key={side.key}>
            <header>
              <span
                className="asset-risk-tag"
                style={{ color: assetColor(side.key) }}
              >
                <i style={{ background: assetColor(side.key) }} />
                {side.label}
              </span>
              <strong>{assetPct(share(side.amount))}</strong>
              <small>
                {assetCompact(side.amount)} · {side.rows.length}개 분류
              </small>
            </header>
            <ul>
              {side.rows.map((row) => (
                <li key={row.key}>
                  <button onClick={() => onRow(row.key, row.name)}>
                    <span>{row.name}</span>
                    <i className="asset-bar">
                      <b
                        style={{
                          width: `${side.max > 0 ? (row.amount / side.max) * 100 : 0}%`,
                          background: assetColor(row.key),
                        }}
                      />
                    </i>
                    <em>
                      {assetPct(
                        side.amount > 0 ? row.amount / side.amount : null,
                      )}
                    </em>
                    <b>{assetCompact(row.amount)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
// 종목은 사람이 아니라 종목 단위로 본다. 같은 종목을 둘이 나눠 들고 있어도 규모는 하나다.
const shares = (n: number | null) =>
  n === null ? "" : `${Math.round(n).toLocaleString("ko-KR")}주`;
const STOCK_TOP = 5;
function AssetStockCard({
  board,
  onOpen,
}: {
  board: AssetStockBoard;
  onOpen: () => void;
}) {
  const top = board.holdings.slice(0, STOCK_TOP);
  return (
    <article className="asset-stock-card">
      <header>
        <button
          onClick={onOpen}
          disabled={!board.count}
          title={`${board.name} 전체 종목 보기`}
        >
          <i
            className="asset-dot"
            style={{ background: assetColor(board.key) }}
          />
          {board.name}
        </button>
        <strong>{assetCompact(board.total)}</strong>
      </header>
      <p className="asset-stock-meta">
        {board.count}종목
        {board.quantity !== null && ` · 보유 ${shares(board.quantity)}`}
      </p>
      {top.length ? (
        <>
          <AssetHoldingList board={board} holdings={top} />
          <button className="asset-stock-more" onClick={onOpen}>
            전체 {board.count}종목 · 비중 보기 <ChevronRight size={15} />
          </button>
        </>
      ) : (
        <p className="muted small">기록된 종목이 없습니다.</p>
      )}
    </article>
  );
}
// 카드와 팝업이 같은 줄 모양을 쓴다. 막대는 그 그룹의 1위 종목을 가득 찬 길이로 그린다.
function AssetHoldingList({
  board,
  holdings,
}: {
  board: AssetStockBoard;
  holdings: AssetStockBoard["holdings"];
}) {
  const max = board.holdings[0]?.amount ?? 0;
  return (
    <ol className="asset-stock-list">
      {holdings.map((holding, i) => (
        <li key={holding.name}>
          <span className="asset-rank">{i + 1}</span>
          <div className="asset-stock-name">
            <strong>{holding.name}</strong>
            {holding.detail && <small>{holding.detail}</small>}
          </div>
          <div className="asset-stock-figure">
            <strong>{assetCompact(holding.amount)}</strong>
            <small>
              {assetPct(board.total > 0 ? holding.amount / board.total : null)}
              {holding.quantity !== null && ` · ${shares(holding.quantity)}`}
            </small>
          </div>
          <i className="asset-bar">
            <b
              style={{
                width: `${max > 0 ? (holding.amount / max) * 100 : 0}%`,
                background: assetColor(board.key),
              }}
            />
          </i>
        </li>
      ))}
    </ol>
  );
}
// 카드의 전체 보기와 도넛의 주식 조각이 여는 팝업. 금액순 전체 종목과 그룹 내 비중을 본다.
function AssetStockDialog({
  board,
  period,
  onClose,
}: {
  board: AssetStockBoard;
  period: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <dialog
      ref={dialog}
      className="record-dialog asset-stock-dialog"
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={`${board.name} 전체 종목`}
    >
      <header>
        <div>
          <span className="eyebrow">{period} 최신 기록</span>
          <h2>
            <i
              className="asset-dot"
              style={{ background: assetColor(board.key) }}
            />
            {board.name}
            <strong>{assetMoney(board.total)}</strong>
          </h2>
          <p className="asset-stock-meta">
            {board.count}종목
            {board.quantity !== null && ` · 보유 ${shares(board.quantity)}`} ·
            비중은 그룹 합계 대비
          </p>
        </div>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="asset-stock-dialog-list">
        <AssetHoldingList board={board} holdings={board.holdings} />
      </div>
    </dialog>
  );
}
// 총자산 카드의 남는 높이를 채우는 추이 선. 축·눈금 없이 모양만 보고, 자세한 값은 아래 차트가 맡는다.
function AssetSparkline({
  periods,
  values,
}: {
  periods: string[];
  values: number[];
}) {
  if (values.length < 2) return <div className="asset-sparkline" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * 100, 36 - ((v - min) / span) * 32] as const,
  );
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div className="asset-sparkline">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        <polygon points={`0,40 ${line} 100,40`} />
        <polyline points={line} />
      </svg>
      <span>
        <small>{periodLabel(periods[0])}</small>
        <small>{periodLabel(periods.at(-1)!)}</small>
      </span>
    </div>
  );
}
