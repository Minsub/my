"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineChart, X } from "lucide-react";
import {
  ASSET_HIDDEN,
  assetChangeRate,
  assetChangeText,
  assetChangeTone,
  assetCompact,
  assetMoney,
  assetPct,
  assetRanges,
  assetSignedMoney,
  assetSignedPct,
  assetTimelineSeries,
  periodLabel,
  type AssetAxis,
  type AssetPeriod,
  type AssetTimelinePoint,
} from "@/lib/assets";
import type { AssetOverview } from "@/server/assets";
import {
  AssetLine,
  AssetNetChart,
  assetColor,
  type AssetSeries,
} from "./asset-chart";

// 표의 합계 행은 축의 묶음이 아니므로 그룹 key와 겹치지 않는 이름을 쓴다.
const TOTAL_KEY = "__total__";
const share = (n: number, of: number) => assetPct(of > 0 ? n / of : null);

// 자산추이 화면. 표시 범위 안의 흐름과 직전 기간(월별은 전월, 연별은 전년) 대비 증감을 본다.
// 위에서 기간을 고르면 항목별 증감·항목별 흐름이 그 기간을 기준으로 바뀐다.
export function AssetTrendView({
  data,
  axis,
  period,
  hide,
  onDrill,
}: {
  data: AssetOverview;
  axis: AssetAxis;
  period: AssetPeriod;
  hide: boolean;
  onDrill: (at: string, bucket: string) => void;
}) {
  const unit = period === "year" ? "전년" : "전월";
  const timeline = data.timelines[axis];
  const series = useMemo(() => assetTimelineSeries(timeline), [timeline]);
  const periods = useMemo(() => timeline.map((p) => p.period), [timeline]);
  const totals = useMemo(() => timeline.map((p) => p.total), [timeline]);
  const [picked, setPicked] = useState<string | null>(null);
  const [trend, setTrend] = useState<string | null>(null);
  // 고른 기간이 표시 범위 밖으로 나가면 최신 기간으로 돌아간다.
  const sel =
    picked && periods.includes(picked)
      ? periods.indexOf(picked)
      : periods.length - 1;
  const select = useCallback(
    (i: number) => setPicked(periods[i] ?? null),
    [periods],
  );
  const trendSeries =
    trend === TOTAL_KEY
      ? { key: TOTAL_KEY, name: "합계", values: totals }
      : series.find((s) => s.key === trend);
  if (!periods.length) return null;
  return (
    <>
      <AssetTrendKpis data={data} axis={axis} unit={unit} hide={hide} />
      <section className="panel">
        <div className="section-heading compact">
          <h2>총자산과 순증감</h2>
          <span className="muted small">
            {period === "year" ? "연별" : "월별"} · 기간을 누르면 아래 항목이 그
            기간 기준으로 바뀝니다
          </span>
        </div>
        <AssetNetChart
          periods={periods}
          totals={totals}
          selected={sel}
          onSelect={select}
          hide={hide}
          unit={unit}
        />
      </section>
      <AssetItemChanges
        timeline={timeline}
        series={series}
        sel={sel}
        unit={unit}
        hide={hide}
        onSelect={select}
        onDrill={onDrill}
      />
      <AssetItemFlows
        timeline={timeline}
        series={series}
        sel={sel}
        unit={unit}
        hide={hide}
        onOpen={setTrend}
      />
      <section className="panel">
        <div className="section-heading compact">
          <h2>항목별 증감 히트맵</h2>
          <span className="asset-heat-key" aria-hidden>
            {unit} 대비
            <i style={{ background: heatColor(-1, 1) }} />
            감소
            <i style={{ background: heatColor(-0.15, 1) }} />
            <i style={{ background: heatColor(0.15, 1) }} />
            증가
            <i style={{ background: heatColor(1, 1) }} />
          </span>
        </div>
        <AssetHeatmap
          timeline={timeline}
          series={series}
          sel={sel}
          unit={unit}
          hide={hide}
          onSelect={select}
          onSeries={setTrend}
        />
      </section>
      {trendSeries && (
        <AssetTrendDialog
          name={trendSeries.name}
          color={
            trendSeries.key === TOTAL_KEY
              ? "#3f4a3f"
              : assetColor(trendSeries.key)
          }
          unit={period === "year" ? "연별" : "월별"}
          periods={periods}
          values={trendSeries.values}
          hide={hide}
          onClose={() => setTrend(null)}
        />
      )}
    </>
  );
}

// 최신 기간과 그 직전 기간. 기록이 없는 기간은 축에 없으므로 바로 앞 점이 직전 기간이다.
function lastTwo(timeline: AssetTimelinePoint[]) {
  const withData = timeline.filter((p) => p.total > 0);
  return [withData.at(-1) ?? null, withData.at(-2) ?? null] as const;
}
const bucketAmount = (point: AssetTimelinePoint | null, key: string) =>
  point?.buckets.find((b) => b.key === key)?.amount ?? 0;

// 네 칸: 연평균 증가율, 원화·달러 직전 대비, 총자산 직전 대비(늘어난 합·줄어든 합), 가장 크게 움직인 항목.
function AssetTrendKpis({
  data,
  axis,
  unit,
  hide,
}: {
  data: AssetOverview;
  axis: AssetAxis;
  unit: string;
  hide: boolean;
}) {
  const withData = data.timelines.group.filter((p) => p.total > 0);
  const first = withData[0];
  const last = withData.at(-1);
  const spanChange =
    first && last && first !== last ? last.total - first.total : null;
  const [curNow, curBefore] = lastTwo(data.timelines.currency);
  const [now, before] = lastTwo(data.timelines[axis]);
  const moves = now
    ? assetTimelineSeries(data.timelines[axis]).map((s) => {
        const a = bucketAmount(now, s.key);
        const b = before ? bucketAmount(before, s.key) : null;
        return {
          key: s.key,
          name: s.name,
          change: b === null ? null : a - b,
          rate: b === null ? null : assetChangeRate(a, b),
        };
      })
    : [];
  const ups = moves.filter((m) => (m.change ?? 0) > 0);
  const downs = moves.filter((m) => (m.change ?? 0) < 0);
  const gain = ups.reduce((n, m) => n + (m.change ?? 0), 0);
  const loss = downs.reduce((n, m) => n + (m.change ?? 0), 0);
  const top = [...ups].sort((a, b) => b.change! - a.change!)[0];
  const bottom = [...downs].sort((a, b) => a.change! - b.change!)[0];
  const total = now && before ? now.total - before.total : null;
  const since = before
    ? `${periodLabel(before.period)} → ${periodLabel(now!.period)}`
    : "직전 비교 없음";
  return (
    <section className="asset-kpis" aria-label="추이 요약">
      <div className="asset-kpi">
        <span className="asset-kpi-label">연평균 자산 증가율</span>
        <strong
          className={`asset-kpi-value ${data.cagr === null ? "" : data.cagr >= 0 ? "up" : "down"}`}
        >
          {assetSignedPct(data.cagr)}
        </strong>
        {/* 비율만 있으면 "그래서 얼마 늘었나"를 못 읽는다. 구간의 실제 증감액을 같이 적는다. */}
        {spanChange !== null && (
          <p className="asset-kpi-sub">
            <b className={assetChangeTone(spanChange)}>
              {hide
                ? assetSignedPct(assetChangeRate(last!.total, first!.total))
                : assetSignedMoney(spanChange)}
            </b>
            {!hide &&
              ` · ${assetCompact(first!.total)} → ${assetCompact(last!.total)}`}
          </p>
        )}
        <p className="asset-kpi-sub">
          {assetRanges.find((r) => r.key === data.range)?.label} ·{" "}
          {withData.length}개 기간
          {first && ` · ${periodLabel(first.period)}부터`}
        </p>
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">원화 · 달러 {unit} 대비</span>
        <ul className="asset-kpi-lines">
          {(
            [
              ["KRW", "원화"],
              ["USD", "달러"],
            ] as const
          ).map(([key, label]) => {
            const a = bucketAmount(curNow, key);
            const b = curBefore ? bucketAmount(curBefore, key) : null;
            const change = b === null ? null : a - b;
            const rate = b === null ? null : assetChangeRate(a, b);
            return (
              <li key={key}>
                <span>
                  <i style={{ background: assetColor(key) }} />
                  {label}
                  {!hide && <small>{assetCompact(a)}</small>}
                </span>
                <b className={assetChangeTone(change)}>
                  {hide ? assetSignedPct(rate) : assetSignedMoney(change)}
                </b>
                {!hide && (
                  <em className={assetChangeTone(change)}>
                    {assetSignedPct(rate)}
                  </em>
                )}
              </li>
            );
          })}
        </ul>
        <p className="asset-kpi-sub">{since}</p>
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">총자산 {unit} 대비</span>
        <strong className={`asset-kpi-value ${assetChangeTone(total)}`}>
          {total === null
            ? "—"
            : hide
              ? assetSignedPct(assetChangeRate(now!.total, before!.total))
              : assetSignedMoney(total)}
        </strong>
        {total !== null && (
          // 순증감이 작아도 안에서는 크게 오갔을 수 있다. 늘어난 합과 줄어든 합을 따로 적는다.
          <ul className="asset-kpi-lines">
            <li>
              <span>늘어난 항목 {ups.length}개</span>
              <b className="up">
                {hide
                  ? `▲${share(gain, before!.total)}`
                  : `▲${assetCompact(gain)}`}
              </b>
            </li>
            <li>
              <span>줄어든 항목 {downs.length}개</span>
              <b className="down">
                {hide
                  ? `▼${share(-loss, before!.total)}`
                  : `▼${assetCompact(-loss)}`}
              </b>
            </li>
          </ul>
        )}
        <p className="asset-kpi-sub">
          {total === null
            ? since
            : `${since} · ${assetSignedPct(assetChangeRate(now!.total, before!.total))}`}
        </p>
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">가장 크게 움직인 항목</span>
        <ul className="asset-kpi-lines">
          {[top, bottom].map(
            (m, i) =>
              m && (
                <li key={m.key}>
                  <span>
                    <i style={{ background: assetColor(m.key) }} />
                    {m.name}
                  </span>
                  <b className={assetChangeTone(m.change)}>
                    {assetChangeText(m.change, m.rate, hide)}
                  </b>
                  <em className="flat">
                    {i === 0 ? "가장 늘어남" : "가장 줄어듦"}
                  </em>
                </li>
              ),
          )}
          {!top && !bottom && (
            <li>
              <span>움직인 항목이 없습니다</span>
            </li>
          )}
        </ul>
        <p className="asset-kpi-sub">{since}</p>
      </div>
    </section>
  );
}

// 고른 기간의 항목별 증감을 크기순으로 늘어난 쪽(오른쪽)·줄어든 쪽(왼쪽) 막대로 본다.
// 막대 길이는 이 기간에 가장 크게 움직인 항목을 가득 찬 길이로 쓴다.
function AssetItemChanges({
  timeline,
  series,
  sel,
  unit,
  hide,
  onSelect,
  onDrill,
}: {
  timeline: AssetTimelinePoint[];
  series: AssetSeries[];
  sel: number;
  unit: string;
  hide: boolean;
  onSelect: (index: number) => void;
  onDrill: (at: string, bucket: string) => void;
}) {
  const at = timeline[sel];
  const prev = sel > 0 ? timeline[sel - 1] : null;
  const rows = prev
    ? series
        .map((s) => {
          const now = s.values[sel] ?? 0;
          const before = s.values[sel - 1] ?? 0;
          return {
            ...s,
            now,
            before,
            change: now - before,
            rate: assetChangeRate(now, before),
          };
        })
        .filter((r) => r.now || r.before)
        .sort((a, b) => b.change - a.change)
    : [];
  const max = Math.max(0, ...rows.map((r) => Math.abs(r.change)));
  const gain = rows
    .filter((r) => r.change > 0)
    .reduce((n, r) => n + r.change, 0);
  const loss = rows
    .filter((r) => r.change < 0)
    .reduce((n, r) => n + r.change, 0);
  const net = prev ? at.total - prev.total : null;
  return (
    <section className="panel">
      <div className="section-heading compact">
        <h2>항목별 증감</h2>
        {timeline.length > 1 && (
          <label className="asset-select">
            <select
              aria-label="비교 기간"
              value={sel}
              onChange={(e) => onSelect(Number(e.target.value))}
            >
              {timeline.map((p, i) =>
                i === 0 ? null : (
                  <option key={p.period} value={i}>
                    {periodLabel(timeline[i - 1].period)} →{" "}
                    {periodLabel(p.period)}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
      </div>
      {!prev ? (
        <p className="muted small">
          {periodLabel(at.period)}은 표시 범위의 첫 기간이라 비교할 직전 기간이
          없습니다.
        </p>
      ) : (
        <>
          <p className="asset-diverge-sum">
            {unit} 대비 순증감{" "}
            <b className={assetChangeTone(net)}>
              {assetChangeText(
                net,
                assetChangeRate(at.total, prev.total),
                hide,
              )}
            </b>
            <span>
              늘어난 합{" "}
              <b className="up">
                {hide
                  ? `▲${share(gain, prev.total)}`
                  : `▲${assetCompact(gain)}`}
              </b>
            </span>
            <span>
              줄어든 합{" "}
              <b className="down">
                {hide
                  ? `▼${share(-loss, prev.total)}`
                  : `▼${assetCompact(-loss)}`}
              </b>
            </span>
          </p>
          <div className="asset-diverge" role="list">
            <div className="asset-diverge-row asset-diverge-head" aria-hidden>
              <span>항목</span>
              <span className="asset-diverge-was">
                {periodLabel(prev.period)} → {periodLabel(at.period)}
              </span>
              <span className="asset-diverge-neg">줄어듦</span>
              <span className="asset-diverge-pos">늘어남</span>
              <span className="asset-diverge-value">증감</span>
            </div>
            {rows.map((r) => (
              <button
                key={r.key}
                className="asset-diverge-row"
                role="listitem"
                onClick={() => onDrill(at.period, r.key)}
                title={`${r.name} ${periodLabel(at.period)} 종목 보기`}
              >
                <span className="asset-diverge-name">
                  <i
                    className="asset-dot"
                    style={{ background: assetColor(r.key) }}
                  />
                  <span>{r.name}</span>
                </span>
                <span className="asset-diverge-was">
                  {hide
                    ? `${share(r.before, prev.total)} → ${share(r.now, at.total)}`
                    : `${assetCompact(r.before)} → ${assetCompact(r.now)}`}
                </span>
                <span className="asset-diverge-neg">
                  {r.change < 0 && (
                    <i
                      style={{ width: `${(Math.abs(r.change) / max) * 100}%` }}
                    />
                  )}
                </span>
                <span className="asset-diverge-pos">
                  {r.change > 0 && (
                    <i style={{ width: `${(r.change / max) * 100}%` }} />
                  )}
                </span>
                <span
                  className={`asset-diverge-value ${assetChangeTone(r.change)}`}
                >
                  {hide ? (
                    assetChangeText(r.change, r.rate, true)
                  ) : (
                    <>
                      {assetChangeText(r.change, null)}
                      <small>
                        {r.rate === null ? "새 항목" : assetSignedPct(r.rate)}
                      </small>
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// 항목마다 자기 세로축으로 그린 작은 추이. 작은 항목의 기울기가 큰 항목에 눌리지 않는다.
// 진한 구간은 지금 고른 기간과 그 직전 기간이다. 누르면 큰 선 그래프를 연다.
function AssetItemFlows({
  timeline,
  series,
  sel,
  unit,
  hide,
  onOpen,
}: {
  timeline: AssetTimelinePoint[];
  series: AssetSeries[];
  sel: number;
  unit: string;
  hide: boolean;
  onOpen: (key: string) => void;
}) {
  const shown = series.filter((s) => s.values.some((v) => v > 0));
  return (
    <section className="panel">
      <div className="section-heading compact">
        <h2>항목별 흐름</h2>
        <span className="muted small">
          항목마다 세로축이 따로입니다 · 진한 구간은{" "}
          {periodLabel(timeline[sel].period)} {unit} 대비
        </span>
      </div>
      <div className="asset-flows">
        {shown.map((s) => {
          const now = s.values[sel] ?? 0;
          const before = sel > 0 ? (s.values[sel - 1] ?? 0) : null;
          const change = before === null ? null : now - before;
          return (
            <button
              key={s.key}
              onClick={() => onOpen(s.key)}
              title={`${s.name} 추이 보기`}
            >
              <span className="asset-flow-name">
                <i
                  className="asset-dot"
                  style={{ background: assetColor(s.key) }}
                />
                <span>{s.name}</span>
              </span>
              <span className="asset-flow-figure">
                <b>
                  {hide ? share(now, timeline[sel].total) : assetCompact(now)}
                </b>
                <em className={assetChangeTone(change)}>
                  {assetChangeText(
                    change,
                    before === null ? null : assetChangeRate(now, before),
                    hide,
                  )}
                </em>
              </span>
              <FlowSpark
                values={s.values}
                sel={sel}
                color={assetColor(s.key)}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
function FlowSpark({
  values,
  sel,
  color,
}: {
  values: number[];
  sel: number;
  color: string;
}) {
  if (values.length < 2)
    return <svg className="asset-flow-spark" aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * 100, 34 - ((v - min) / span) * 30] as const,
  );
  const line = (pts: (readonly [number, number])[]) =>
    pts.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg
      className="asset-flow-spark"
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line x1={xy[sel][0]} x2={xy[sel][0]} y1="0" y2="36" stroke="#d9dccf" />
      <polyline points={line(xy)} stroke={color} strokeOpacity={0.55} />
      {sel > 0 && (
        <polyline points={line(xy.slice(sel - 1, sel + 1))} stroke="#283a32" />
      )}
    </svg>
  );
}

// 칸 색은 직전 기간 대비 증감률이다. 증가 빨강·감소 파랑이고, 진할수록 많이 움직였다.
// t는 -1~1로 줄인 증감률이고 strength는 그 칸의 진하기다(범례는 1).
function heatColor(t: number, strength = Math.abs(t)) {
  const rgb = t >= 0 ? "196,54,47" : "47,95,196";
  return `rgba(${rgb},${(0.07 + 0.6 * Math.min(1, strength)).toFixed(3)})`;
}
// 항목 × 기간 표. 칸에는 증감액과 증감률을 적고 색으로 증감률을 보인다.
// 같은 데이터를 금액 표로 보면 숫자를 하나씩 읽어야 하지만, 색으로 보면 어느 달에 무엇이 움직였는지 한눈에 들어온다.
// 열(기간)을 누르면 위 차트·항목별 증감과 같은 기간을 고른다. 이름을 누르면 그 항목의 선 그래프가 열린다.
function AssetHeatmap({
  timeline,
  series,
  sel,
  unit,
  hide,
  onSelect,
  onSeries,
}: {
  timeline: AssetTimelinePoint[];
  series: AssetSeries[];
  sel: number;
  unit: string;
  hide: boolean;
  onSelect: (index: number) => void;
  onSeries: (key: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // 월별은 5%, 연별은 25% 움직이면 가장 진한 색이다.
  const scale = unit === "전월" ? 0.05 : 0.25;
  const rows = useMemo(
    () => [
      { key: TOTAL_KEY, name: "합계", values: timeline.map((p) => p.total) },
      ...series,
    ],
    [timeline, series],
  );
  // 기간이 많으면 가로로 스크롤한다. 고른 기간(처음은 최신)이 보이도록 당긴다.
  useEffect(() => {
    const el = box.current;
    const th = el?.querySelector<HTMLElement>("th.selected");
    if (!el || !th) return;
    const left = th.offsetLeft + th.offsetWidth - el.clientWidth + 8;
    if (left > el.scrollLeft || th.offsetLeft < el.scrollLeft)
      el.scrollLeft = Math.max(0, left);
  }, [sel, timeline]);
  return (
    <div className="asset-table-scroll" ref={box}>
      <table className="asset-heat">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {timeline.map((p, i) => (
              <th
                scope="col"
                key={p.period}
                className={i === sel ? "selected" : ""}
              >
                <button onClick={() => onSelect(i)}>
                  {periodLabel(p.period)}
                </button>
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
                  const t =
                    change === null || !change
                      ? null
                      : rate === null
                        ? Math.sign(change)
                        : Math.max(-1, Math.min(1, rate / scale));
                  const strong = t !== null && Math.abs(t) > 0.62;
                  return (
                    <td
                      key={timeline[i].period}
                      className={i === sel ? "selected" : ""}
                      style={
                        t === null ? undefined : { background: heatColor(t) }
                      }
                    >
                      <button
                        className={strong ? "strong" : ""}
                        onClick={() => onSelect(i)}
                        title={`${row.name} ${periodLabel(timeline[i].period)}${hide ? "" : ` ${assetMoney(value)}`}`}
                      >
                        {change === null ? (
                          <>
                            <b className="flat">—</b>
                            <small>
                              {hide
                                ? total
                                  ? ASSET_HIDDEN
                                  : assetPct(
                                      timeline[i].total > 0
                                        ? value / timeline[i].total
                                        : null,
                                    )
                                : assetCompact(value)}
                            </small>
                          </>
                        ) : hide ? (
                          <b>{assetChangeText(change, rate, true)}</b>
                        ) : (
                          <>
                            <b>{assetChangeText(change, null)}</b>
                            <small>
                              {rate === null ? "새 항목" : assetSignedPct(rate)}
                            </small>
                          </>
                        )}
                      </button>
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
// 한 항목만 선으로 크게 본다. 세로축은 값 범위에 맞춘다.
function AssetTrendDialog({
  name,
  color,
  unit,
  periods,
  values,
  hide,
  onClose,
}: {
  name: string;
  color: string;
  unit: string;
  periods: string[];
  values: number[];
  hide: boolean;
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
              {hide ? "" : `최근 ${assetMoney(last)}`}
              {change !== null && (
                <>
                  {hide ? "기간 내 " : " · 기간 내 "}
                  <em className={!change ? "" : change > 0 ? "up" : "down"}>
                    {hide
                      ? assetSignedPct(assetChangeRate(last, first))
                      : `${assetSignedMoney(change)} (${assetSignedPct(assetChangeRate(last, first))})`}
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
          hide={hide}
        />
      </div>
    </dialog>
  );
}
