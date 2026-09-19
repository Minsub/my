"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, TriangleAlert, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  assetAxes,
  assetCompact,
  assetGroups,
  assetMoney,
  assetPct,
  assetSignedMoney,
  assetSignedPct,
  assetRanges,
  assetTimelineSeries,
  periodLabel,
  type AssetAxis,
  type AssetPeriod,
  type AssetRange,
} from "@/lib/assets";
import type { AssetOverview } from "@/server/assets";
import { AssetPie, AssetTrend, assetColor } from "./asset-chart";
import { AssetDetail, type AssetDetailTarget } from "./asset-detail";
import { RecordForm, type FormSpec } from "./record-form";
import { today } from "@/lib/format";
import type { Operation } from "@/lib/contracts";
import { demoAssetOverview, demoAssetItems } from "@/lib/demo-assets";

const periods: { key: AssetPeriod; label: string }[] = [
  { key: "month", label: "월별" },
  { key: "year", label: "연별" },
];
const chartAxes = assetAxes.filter(
  (a) => a.key === "group" || a.key === "parent",
);
const recordable = assetGroups.filter((g) => g.key !== "unclassified");

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
  const snapshotForm = (ownerId: string) =>
    open({
      title: "자산 현황 기록",
      description:
        "그 날짜의 자산 전체를 저장합니다. 같은 사람·같은 날짜로 저장하면 기존 기록을 교체합니다. 자세한 종목별 기록은 AI 연결로 한 번에 넣을 수 있습니다.",
      operation: "asset_record_snapshot",
      extra: { owner_id: ownerId, expected_version: null },
      fields: [
        {
          name: "as_of",
          label: "기준일",
          type: "date",
          value: today(),
          required: true,
        },
        ...recordable.map((group) => ({
          name: group.key,
          label: `${group.name} (${group.parent})`,
          type: "number" as const,
          min: 0,
        })),
        { name: "note", label: "메모", type: "textarea" },
      ],
      transform: (values) => {
        const items = recordable
          .map((group) => ({
            group_key: group.key,
            name: group.name,
            broker: "",
            amount: Number(values[group.key] ?? 0) || 0,
            quantity: null,
            profit: null,
            profit_rate: null,
          }))
          .filter((item) => item.amount > 0);
        for (const group of recordable) delete values[group.key];
        return {
          ...values,
          items: items.length
            ? items
            : [
                {
                  group_key: "cash",
                  name: "현금",
                  broker: "",
                  amount: 0,
                  quantity: null,
                  profit: null,
                  profit_rate: null,
                },
              ],
        };
      },
    });
  const activeOwners = data?.owners.filter((o) => o.active) ?? [];
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
          onClick={() =>
            activeOwners.length
              ? snapshotForm(owner !== "all" ? owner : activeOwners[0].id)
              : ownerForm()
          }
        >
          <Plus size={18} />
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
      </div>
    );
  if (loading || !data)
    return (
      <div className="asset-page">
        {heading}
        <p className="muted">불러오는 중입니다…</p>
      </div>
    );
  const summary = data.summaries[axis];
  const groupSummary = data.summaries.group;
  const timeline = data.timelines[axis];
  const series = assetTimelineSeries(timeline);
  const points = timeline.map((p) => p.period);
  const mix = data.currencyMix;
  const mixTotal = mix.KRW + mix.USD + mix.NONE;
  const drill = (at: string, bucket: string) => {
    const label =
      timeline
        .find((p) => p.period === at)
        ?.buckets.find((b) => b.key === bucket)?.name ?? bucket;
    setDetail({ at, axis, bucket, label });
  };
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
              <button
                className="button primary"
                onClick={() =>
                  snapshotForm(owner !== "all" ? owner : activeOwners[0].id)
                }
              >
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
              <section className="asset-kpis" aria-label="자산 요약">
                <div>
                  <span>총자산</span>
                  <strong>{assetMoney(groupSummary.total)}</strong>
                  <small>
                    {periodLabel(groupSummary.period)} 기준 ·{" "}
                    {groupSummary.change === null
                      ? "직전 비교 없음"
                      : `직전 ${assetSignedMoney(groupSummary.change)} (${assetSignedPct(groupSummary.change_rate)})`}
                  </small>
                </div>
                <div>
                  <span>연평균 자산 증가율</span>
                  <strong
                    className={
                      data.cagr === null ? "" : data.cagr >= 0 ? "up" : "down"
                    }
                  >
                    {assetSignedPct(data.cagr)}
                  </strong>
                  <small>
                    {assetRanges.find((r) => r.key === data.range)?.label} ·{" "}
                    {data.timelines.group.filter((p) => p.total > 0).length}개
                    기간 기준 CAGR
                  </small>
                </div>
                <div>
                  <span>원화 / 달러 비율</span>
                  <strong>
                    {assetPct(mixTotal > 0 ? mix.KRW / mixTotal : null)} /{" "}
                    {assetPct(mixTotal > 0 ? mix.USD / mixTotal : null)}
                  </strong>
                  <div className="asset-mix-bar">
                    <i
                      style={{
                        width: `${mixTotal > 0 ? (mix.KRW / mixTotal) * 100 : 0}%`,
                        background: assetColor("KRW"),
                      }}
                    />
                    <i
                      style={{
                        width: `${mixTotal > 0 ? (mix.USD / mixTotal) * 100 : 0}%`,
                        background: assetColor("USD"),
                      }}
                    />
                    <i
                      style={{
                        width: `${mixTotal > 0 ? (mix.NONE / mixTotal) * 100 : 0}%`,
                        background: assetColor("NONE"),
                      }}
                    />
                  </div>
                  <small>
                    원화 {assetCompact(mix.KRW)} · 달러 {assetCompact(mix.USD)}
                    {mix.NONE > 0 && ` · 기타 ${assetCompact(mix.NONE)}`}
                  </small>
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
                <div
                  className="asset-chips"
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
                    onSlice={(key) => summary && drill(summary.period, key)}
                  />
                </div>
              </section>
              <section className="panel">
                <div className="section-heading compact">
                  <h2>기간별 금액·비중·증감</h2>
                  <span className="muted small">
                    {period === "year" ? "연별" : "월별"} · 셀을 누르면 종목을
                    봅니다
                  </span>
                </div>
                <AssetMatrix
                  timeline={timeline}
                  series={series}
                  onCell={drill}
                />
              </section>
              <section className="panel">
                <div className="section-heading compact">
                  <h2>구성원별</h2>
                  <span className="muted small">최신 기간 기준</span>
                </div>
                <div className="asset-owner-cards">
                  {data.ownerTotals.map((o) => (
                    <div key={o.owner_id}>
                      <span>{o.name}</span>
                      <strong>{assetMoney(o.total)}</strong>
                      <small>
                        {o.as_of ? o.as_of.replaceAll("-", ".") : "기록 없음"}
                        {o.change !== null &&
                          ` · ${assetSignedMoney(o.change)}`}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
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
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
// 한 칸에 금액·비중·증감을 함께 적는다. 값마다 표를 따로 만들면 세 번 훑어야 한다.
function AssetMatrix({
  timeline,
  series,
  onCell,
}: {
  timeline: AssetOverview["timelines"][AssetAxis];
  series: { key: string; name: string; values: number[] }[];
  onCell: (period: string, key: string) => void;
}) {
  const totals = useMemo(() => timeline.map((p) => p.total), [timeline]);
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
          {series.map((s) => (
            <tr key={s.key}>
              <th scope="row">
                <i
                  className="asset-dot"
                  style={{ background: assetColor(s.key) }}
                />
                {s.name}
              </th>
              {s.values.map((value, i) => {
                const change = i === 0 ? null : value - s.values[i - 1];
                return (
                  <td key={timeline[i].period}>
                    <button
                      className="asset-cell"
                      onClick={() => onCell(timeline[i].period, s.key)}
                    >
                      <b>{assetCompact(value)}</b>
                      <span>
                        {assetPct(totals[i] > 0 ? value / totals[i] : null)}
                      </span>
                      <em
                        className={
                          change === null || change === 0
                            ? ""
                            : change > 0
                              ? "up"
                              : "down"
                        }
                      >
                        {change === null ? "—" : assetSignedMoney(change)}
                      </em>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="asset-total-row">
            <th scope="row">합계</th>
            {timeline.map((p, i) => {
              const change = i === 0 ? null : p.total - totals[i - 1];
              return (
                <td key={p.period}>
                  <b>{assetCompact(p.total)}</b>
                  <span>100.0%</span>
                  <em
                    className={
                      change === null || change === 0
                        ? ""
                        : change > 0
                          ? "up"
                          : "down"
                    }
                  >
                    {change === null ? "—" : assetSignedMoney(change)}
                  </em>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
