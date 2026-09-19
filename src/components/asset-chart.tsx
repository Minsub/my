"use client";
import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import {
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
// 막대로 그린다. 기본은 누적이라 총자산 증감이 바로 보이고,
// 작은 항목은 큰 항목에 눌려 변화가 안 보이므로 대칭 로그 축으로 펼치는 전환을 둔다.
export function AssetTrend({
  periods,
  series,
  onPoint,
}: {
  periods: string[];
  series: AssetSeries[];
  onPoint?: (period: string, key: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [expand, setExpand] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const visible = series.filter((s) => !hidden.includes(s.key));
    const symlog = (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v));
    // 누적 막대 맨 위에 그 기간의 합산 금액을 적는다. 막대 높이만으로는 총자산이 얼마인지 못 읽는다.
    // 펼침 모드는 누적이 아니라 대칭 로그 축이라 합계를 그릴 자리가 없으므로 건너뛴다.
    const stackTotals = {
      id: "assetStackTotals",
      afterDatasetsDraw(chart: Chart) {
        if (expand || !visible.length) return;
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = "700 10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#3f4a3f";
        // 라벨이 겹치면 못 읽는다. 최신 기간부터 자리를 잡고 겹치는 것만 버린다.
        let leftmost = Infinity;
        for (let i = periods.length - 1; i >= 0; i--) {
          const total = visible.reduce((n, s) => n + (s.values[i] ?? 0), 0);
          const bar = meta.data[i];
          if (!total || !bar) continue;
          const text = assetCompact(total);
          const half = ctx.measureText(text).width / 2 + 4;
          if (bar.x + half > leftmost) continue;
          ctx.fillText(text, bar.x, chart.scales.y.getPixelForValue(total) - 3);
          leftmost = bar.x - half;
        }
        ctx.restore();
      },
    };
    const chart = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: periods.map(periodLabel),
        datasets: visible.map((s) => ({
          label: s.name,
          data: s.values.map((v) => (expand ? symlog(v) : v)),
          backgroundColor: assetColor(s.key) + (expand ? "cc" : "e6"),
          borderColor: assetColor(s.key),
          borderWidth: 0,
          borderRadius: 3,
          categoryPercentage: 0.82,
          barPercentage: expand ? 0.94 : 0.98,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // 합계 라벨이 잘리지 않도록 위쪽을 비워둔다.
        layout: { padding: { top: expand ? 0 : 16 } },
        interaction: { mode: "index", intersect: false },
        onClick: (_, points) => {
          const hit = points[0];
          if (hit && onPoint)
            onPoint(periods[hit.index], visible[hit.datasetIndex].key);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${assetMoney(
                  visible[ctx.datasetIndex].values[ctx.dataIndex],
                )}`,
              footer: (items) =>
                expand
                  ? ""
                  : `합계 ${assetMoney(
                      items.reduce((n, i) => n + i.parsed.y, 0),
                    )}`,
            },
          },
        },
        scales: {
          x: {
            stacked: !expand,
            grid: { display: false },
            ticks: { maxRotation: 0, maxTicksLimit: 8, font: { size: 11 } },
          },
          y: {
            stacked: !expand,
            beginAtZero: true,
            grid: { color: "#e9edf5" },
            ticks: {
              maxTicksLimit: 5,
              font: { size: 11 },
              callback: (v) =>
                assetCompact(
                  expand
                    ? Math.sign(Number(v)) * (10 ** Math.abs(Number(v)) - 1)
                    : Number(v),
                ),
            },
          },
        },
      },
      plugins: [stackTotals],
    });
    return () => chart.destroy();
  }, [periods, series, hidden, expand, onPoint]);
  return (
    <div className="asset-plot">
      <div className="asset-plot-canvas">
        <canvas
          ref={ref}
          role="img"
          aria-label={`${series.map((s) => s.name).join(", ")} 금액 추이`}
        />
      </div>
      <div className="asset-plot-controls">
        <div className="asset-legend" aria-label="표시할 항목">
          {series.map((s) => (
            <button
              key={s.key}
              aria-pressed={!hidden.includes(s.key)}
              onClick={() =>
                setHidden(
                  hidden.includes(s.key)
                    ? hidden.filter((k) => k !== s.key)
                    : [...hidden, s.key],
                )
              }
            >
              <i style={{ background: assetColor(s.key) }} />
              {s.name}
            </button>
          ))}
        </div>
        <button
          className="asset-scale"
          aria-pressed={expand}
          onClick={() => setExpand(!expand)}
        >
          작은 항목 확대 {expand ? "켜짐" : "꺼짐"}
        </button>
      </div>
      {expand && (
        <p className="asset-note">
          항목을 나란히 놓고 대칭 로그 축으로 펼쳤습니다. 작은 항목의 증감을
          보기 위한 표시이며 정확한 금액은 툴팁과 아래 표에서 확인하세요.
        </p>
      )}
    </div>
  );
}
// 조각 위에 비중을 직접 적는다. 가운데 총액은 KPI에 이미 있으므로 넣지 않는다.
const shareLabels = {
  id: "assetShareLabels",
  afterDatasetsDraw(chart: Chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data as number[];
    const total = data.reduce((n, v) => n + Number(v), 0);
    if (!total) return;
    const labels = chart.data.labels as string[];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    meta.data.forEach((arc, i) => {
      const share = Number(data[i]) / total;
      // 조각이 너무 작으면 글자가 겹친다. 그런 항목은 범례에서 읽는다.
      if (share < 0.05) return;
      const { x, y } = (
        arc as unknown as { getCenterPoint(): { x: number; y: number } }
      ).getCenterPoint();
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 2.5;
      const lines = [labels[i], `${(share * 100).toFixed(1)}%`];
      lines.forEach((text, row) => {
        ctx.font = row === 0 ? "600 10px system-ui" : "700 12px system-ui";
        const dy = y + (row === 0 ? -8 : 7);
        ctx.strokeText(text, x, dy);
        ctx.fillText(text, x, dy);
      });
    });
    ctx.restore();
  },
};
export function AssetPie({
  rows,
  total,
  onSlice,
}: {
  rows: { key: string; name: string; amount: number }[];
  total: number;
  onSlice?: (key: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = rows.filter((r) => r.amount > 0);
  useEffect(() => {
    if (!ref.current || !shown.length) return;
    const chart = new Chart(ref.current, {
      type: "pie",
      data: {
        labels: shown.map((r) => r.name),
        datasets: [
          {
            data: shown.map((r) => r.amount),
            backgroundColor: shown.map((r) => assetColor(r.key)),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        onClick: (_, points) => {
          if (points[0] && onSlice) onSlice(shown[points[0].index].key);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.label}: ${assetMoney(ctx.parsed)} · ${assetPct(
                  total > 0 ? ctx.parsed / total : null,
                )}`,
            },
          },
        },
      },
      plugins: [shareLabels],
    });
    return () => chart.destroy();
  }, [shown, total, onSlice]);
  if (!shown.length) return null;
  return (
    <div className="asset-pie">
      <div className="asset-pie-canvas">
        <canvas ref={ref} role="img" aria-label="자산 구성 비중" />
      </div>
      <div className="asset-legend" aria-label="구성 항목">
        {shown.map((r) => (
          <button key={r.key} onClick={() => onSlice?.(r.key)}>
            <i style={{ background: assetColor(r.key) }} />
            {r.name} {assetPct(total > 0 ? r.amount / total : null)}
          </button>
        ))}
      </div>
    </div>
  );
}
// 표에서 한 항목을 눌렀을 때 그 항목만 선으로 본다. 누적 막대에서는 작은 항목의 기울기가 보이지 않는다.
export function AssetLine({
  periods,
  name,
  color,
  values,
}: {
  periods: string[];
  name: string;
  color: string;
  values: number[];
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
              label: (ctx) => assetMoney(Number(ctx.parsed.y)),
              // 기간이 많으면 눈으로 직전 값을 못 찾는다. 툴팁에 증감을 같이 적는다.
              afterLabel: (ctx) => {
                const before = values[ctx.dataIndex - 1];
                if (before === undefined) return "";
                const change = Number(ctx.parsed.y) - before;
                return `직전 대비 ${assetSignedMoney(change)} (${assetSignedPct(
                  before > 0 ? change / before : null,
                )})`;
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
              maxTicksLimit: 5,
              font: { size: 11 },
              callback: (v) => assetCompact(Number(v)),
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [periods, name, color, values]);
  return (
    <>
      <div className="asset-line-canvas">
        <canvas ref={ref} role="img" aria-label={`${name} 금액 추이`} />
      </div>
      <p className="asset-note">
        세로축은 0이 아니라 이 항목의 값 범위에 맞췄습니다. 변화의 모양을 보기
        위한 표시이며 정확한 금액은 점 위에 올려 확인하세요.
      </p>
    </>
  );
}
