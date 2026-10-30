"use client";
import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import {
  assetChangeRate,
  assetCompact,
  assetMoney,
  assetPct,
  assetSignedMoney,
  assetSignedPct,
  periodLabel,
} from "@/lib/assets";
// 그룹마다 색을 고정한다. 조회할 때마다 색이 바뀌면 시계열을 눈으로 따라갈 수 없다.
const fixed: Record<string, string> = {
  kr_stock: "#6366f1",
  kr_listed_foreign_equity: "#8b5cf6",
  foreign_equity: "#ec4899",
  kr_bond: "#0ea5e9",
  foreign_bond: "#06b6d4",
  usd_note_rp: "#14b8a6",
  krw_note_rp: "#10b981",
  deposit: "#84cc16",
  cash: "#f59e0b",
  gold: "#d4a017",
  unclassified: "#94a3b8",
  KRW: "#10b981",
  USD: "#6366f1",
  NONE: "#94a3b8",
  RISKY: "#ef4444",
  SAFE: "#0ea5e9",
  UNKNOWN: "#94a3b8",
};
const fallback = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
];
export function assetColor(key: string) {
  if (fixed[key]) return fixed[key];
  let hash = 0;
  for (const char of key) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return fallback[Math.abs(hash) % fallback.length];
}
export type AssetSeries = { key: string; name: string; values: number[] };
// 총자산 선과 직전 기간 대비 순증감 막대를 한 축(기간) 위에 위아래로 놓는다.
// 항목별 누적 막대는 항목이 잘게 나뉘어 읽히지 않으므로, 여기서는 합계의 흐름만 보고
// 항목별 증감은 기간을 골라 아래 목록에서 본다. 막대마다 증감률을 적고 고른 기간은 금액도 적는다.
export function AssetNetChart({
  periods,
  totals,
  selected,
  onSelect,
  hide = false,
  unit = "직전",
}: {
  periods: string[];
  totals: number[];
  selected: number;
  onSelect: (index: number) => void;
  // 금액 가리기. 금액 축·라벨을 지우고 증감률만 남긴다. 선과 막대의 모양은 그대로다.
  hide?: boolean;
  unit?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const changes = totals.map((v, i) => (i === 0 ? null : v - totals[i - 1]));
    const rates = totals.map((v, i) =>
      i === 0 ? null : assetChangeRate(v, totals[i - 1]),
    );
    const tone = (n: number | null) =>
      !n ? "#9aa392" : n > 0 ? "#c4362f" : "#2f5fc4";
    const rateText = (n: number | null) =>
      n === null
        ? ""
        : `${n > 0 ? "▲" : n < 0 ? "▼" : ""}${Math.abs(n * 100).toFixed(1)}%`;
    // 고른 기간을 세로 띠로 칠해 아래 목록이 어느 기간인지 잇는다.
    const band = {
      id: "assetSelectedBand",
      beforeDatasetsDraw(chart: Chart) {
        const bar = chart.getDatasetMeta(1).data[selected];
        if (!bar) return;
        const { ctx, chartArea } = chart;
        const step =
          periods.length > 1
            ? chartArea.width / periods.length
            : chartArea.width;
        ctx.save();
        ctx.fillStyle = "#eef2e9";
        ctx.fillRect(bar.x - step / 2, chartArea.top, step, chartArea.height);
        ctx.restore();
      },
    };
    // 막대 끝에 증감률을 적는다. 자리가 좁으면 고른 기간만 적는다.
    // 고른 기간은 금액(가리면 생략)과 총자산도 함께 적는다.
    const labels = {
      id: "assetNetLabels",
      afterDatasetsDraw(chart: Chart) {
        const { ctx } = chart;
        const bars = chart.getDatasetMeta(1).data;
        const step = chart.chartArea.width / Math.max(1, periods.length);
        ctx.save();
        ctx.textAlign = "center";
        bars.forEach((bar, i) => {
          const change = changes[i];
          if (change === null || !bar) return;
          const { x, y, base } = bar.getProps(["x", "y", "base"], true) as {
            x: number;
            y: number;
            base: number;
          };
          const isSel = i === selected;
          const text = rateText(rates[i]);
          ctx.font = `${isSel ? 700 : 600} 10px system-ui`;
          if (!isSel && ctx.measureText(text).width > step - 2) return;
          const up = change >= 0;
          const edge = up ? Math.min(y, base) : Math.max(y, base);
          ctx.fillStyle = tone(change);
          ctx.textBaseline = up ? "bottom" : "top";
          const lines =
            isSel && !hide ? [assetSignedMoney(change), text] : [text];
          // 위로 자라는 막대는 위로, 아래로 자라는 막대는 아래로 줄을 쌓는다.
          const ordered = up ? [...lines].reverse() : lines;
          const cx = Math.min(Math.max(x, 24), chart.width - 24);
          ordered.forEach((line, row) =>
            ctx.fillText(
              line,
              cx,
              up ? edge - 2 - row * 12 : edge + 2 + row * 12,
            ),
          );
        });
        const point = chart.getDatasetMeta(0).data[selected];
        if (point && !hide) {
          ctx.font = "700 11px system-ui";
          ctx.fillStyle = "#283a32";
          ctx.textBaseline = "bottom";
          const text = assetCompact(totals[selected]);
          const half = ctx.measureText(text).width / 2 + 2;
          ctx.fillText(
            text,
            Math.min(Math.max(point.x, half), chart.width - half),
            point.y - 8,
          );
        }
        ctx.restore();
      },
    };
    const chart = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: periods.map(periodLabel),
        datasets: [
          {
            type: "line",
            label: "총자산",
            data: totals,
            yAxisID: "y",
            borderColor: "#365b43",
            backgroundColor: "rgba(54,91,67,.08)",
            borderWidth: 2,
            fill: "start",
            tension: 0.2,
            pointRadius: totals.map((_, i) => (i === selected ? 5 : 2.5)),
            pointBackgroundColor: totals.map((_, i) =>
              i === selected ? "#283a32" : "#fff",
            ),
            pointBorderColor: "#365b43",
          },
          {
            type: "bar",
            label: `${unit} 대비 증감`,
            data: changes,
            yAxisID: "change",
            backgroundColor: changes.map(
              (c, i) => tone(c) + (i === selected ? "" : "8c"),
            ),
            borderRadius: 3,
            barPercentage: 0.62,
            categoryPercentage: 0.9,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 18, left: 4, right: 4 } },
        interaction: { mode: "index", intersect: false },
        onClick: (_, points) => {
          if (points[0]) onSelect(points[0].index);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const i = ctx.dataIndex;
                if (ctx.datasetIndex === 0)
                  return hide ? "" : `총자산 ${assetMoney(totals[i])}`;
                if (changes[i] === null) return `${unit} 비교 없음`;
                return hide
                  ? `${unit} 대비 ${assetSignedPct(rates[i])}`
                  : `${unit} 대비 ${assetSignedMoney(changes[i])} (${assetSignedPct(rates[i])})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, maxTicksLimit: 8, font: { size: 11 } },
          },
          // 위 2/3는 총자산 선, 아래 1/3은 순증감 막대다. 같은 stack의 축은 먼저 적은 것이 아래에 놓인다.
          change: {
            type: "linear",
            stack: "net",
            stackWeight: 1.1,
            offset: true,
            grace: "35%",
            grid: {
              color: (c) => (c.tick.value === 0 ? "#c9cbbf" : "transparent"),
            },
            ticks: { display: false },
          },
          // 총자산은 증감이 보이도록 0이 아니라 값 범위에 맞춘다. 막대 차트의 기본값(0부터)을 끈다.
          y: {
            type: "linear",
            stack: "net",
            stackWeight: 2,
            beginAtZero: false,
            grace: "12%",
            grid: { color: "#eef0ea" },
            ticks: {
              display: !hide,
              maxTicksLimit: 4,
              font: { size: 10.5 },
              callback: (v) => assetCompact(Number(v)),
            },
          },
        },
      },
      plugins: [band, labels],
    });
    return () => chart.destroy();
  }, [periods, totals, selected, onSelect, hide, unit]);
  return (
    <div className="asset-net">
      <div className="asset-net-canvas">
        <canvas
          ref={ref}
          role="img"
          aria-label={`총자산과 ${unit} 대비 순증감`}
        />
      </div>
      <p className="asset-note">
        위는 총자산(세로축 0 아님), 아래는 {unit} 대비 순증감과 증감률입니다.
        기간을 누르면 아래 항목별 증감이 그 기간으로 바뀝니다.
      </p>
    </div>
  );
}
// 면적이 금액인 사각형으로 구성을 본다. 도넛은 조각이 열 개를 넘으면 작은 조각의 비중을 못 읽는다.
// 배치는 squarified 알고리즘으로 칸을 정사각형에 가깝게 만들고, 실제 크기를 재서 다시 배치한다.
type TreemapRect = { x: number; y: number; w: number; h: number };
function squarify(values: number[], width: number, height: number) {
  const total = values.reduce((n, v) => n + v, 0);
  const areas = values.map((v) => (v / total) * width * height);
  const out: TreemapRect[] = [];
  let [x, y, w, h] = [0, 0, width, height];
  let row: number[] = [];
  let index: number[] = [];
  const worst = (r: number[], side: number) => {
    const sum = r.reduce((n, v) => n + v, 0);
    return Math.max(
      (side * side * Math.max(...r)) / (sum * sum),
      (sum * sum) / (side * side * Math.min(...r)),
    );
  };
  const lay = () => {
    const sum = row.reduce((n, v) => n + v, 0);
    if (w >= h) {
      const cw = sum / h;
      let yy = y;
      row.forEach((a, j) => {
        out[index[j]] = { x, y: yy, w: cw, h: a / cw };
        yy += a / cw;
      });
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let xx = x;
      row.forEach((a, j) => {
        out[index[j]] = { x: xx, y, w: a / rh, h: rh };
        xx += a / rh;
      });
      y += rh;
      h -= rh;
    }
    row = [];
    index = [];
  };
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row, areas[i]], side) <= worst(row, side)) {
      row.push(areas[i]);
      index.push(i);
      i++;
    } else lay();
  }
  if (row.length) lay();
  return out;
}
export function AssetTreemap({
  rows,
  total,
  onCell,
  hide = false,
}: {
  rows: { key: string; name: string; amount: number }[];
  total: number;
  onCell?: (key: string) => void;
  // 금액 가리기. 칸에는 비중만 적는다.
  hide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const shown = rows
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const rects =
    size.w && size.h && shown.length
      ? squarify(
          shown.map((r) => r.amount),
          size.w,
          size.h,
        )
      : [];
  return (
    <div className="asset-treemap" ref={box} role="list" aria-label="자산 구성">
      {rects.map((rect, i) => {
        const row = shown[i];
        const share = assetPct(total > 0 ? row.amount / total : null);
        // 글자가 칸을 넘으면 읽히지 않으므로 칸 크기에 따라 이름·비중·금액 순으로 줄인다.
        // 못 적은 값은 title로 본다.
        const fits = rect.w >= 54;
        const showName = fits && rect.h >= 46;
        const showShare = rect.w >= 40 && rect.h >= 28;
        const showAmount = !hide && fits && rect.h >= 62;
        return (
          <button
            key={row.key}
            role="listitem"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: assetColor(row.key),
            }}
            title={`${row.name} ${share}${hide ? "" : ` · ${assetMoney(row.amount)}`}`}
            onClick={() => onCell?.(row.key)}
          >
            {showName && <b>{row.name}</b>}
            {showShare && (
              <span>
                {share}
                {showAmount && <small>{assetCompact(row.amount)}</small>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
// 표에서 한 항목을 눌렀을 때 그 항목만 선으로 본다. 누적 막대에서는 작은 항목의 기울기가 보이지 않는다.
export function AssetLine({
  periods,
  name,
  color,
  values,
  hide = false,
}: {
  periods: string[];
  name: string;
  color: string;
  values: number[];
  // 금액 가리기. 축 금액을 지우고 툴팁은 첫 기간·직전 기간 대비 증감률로 적는다.
  hide?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels: periods.map(periodLabel),
        datasets: [
          {
            label: name,
            data: values,
            borderColor: color,
            backgroundColor: color + "22",
            borderWidth: 2,
            pointRadius: periods.length > 24 ? 0 : 3,
            pointBackgroundColor: color,
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (!hide) return assetMoney(Number(ctx.parsed.y));
                const first = values.find((v) => v > 0) ?? 0;
                return `처음 대비 ${assetSignedPct(
                  assetChangeRate(Number(ctx.parsed.y), first),
                )}`;
              },
              // 기간이 많으면 눈으로 직전 값을 못 찾는다. 툴팁에 증감을 같이 적는다.
              afterLabel: (ctx) => {
                const before = values[ctx.dataIndex - 1];
                if (before === undefined) return "";
                const change = Number(ctx.parsed.y) - before;
                const rate = assetSignedPct(
                  before > 0 ? change / before : null,
                );
                return hide
                  ? `직전 대비 ${rate}`
                  : `직전 대비 ${assetSignedMoney(change)} (${rate})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, maxTicksLimit: 8, font: { size: 11 } },
          },
          // 한 항목만 보는 화면이라 0부터 그리면 대부분 평평한 선이 된다.
          // 여기서는 모양을 읽는 것이 목적이므로 값 범위에 맞추고, 축이 0이 아님을 아래에 적는다.
          y: {
            grace: "8%",
            grid: { color: "#e9edf5" },
            ticks: {
              display: !hide,
              maxTicksLimit: 5,
              font: { size: 11 },
              callback: (v) => assetCompact(Number(v)),
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [periods, name, color, values, hide]);
  return (
    <>
      <div className="asset-line-canvas">
        <canvas ref={ref} role="img" aria-label={`${name} 금액 추이`} />
      </div>
      <p className="asset-note">
        세로축은 0이 아니라 이 항목의 값 범위에 맞췄습니다. 변화의 모양을 보기
        위한 표시이며 {hide ? "증감률" : "정확한 금액"}은 점 위에 올려
        확인하세요.
      </p>
    </>
  );
}
