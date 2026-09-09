"use client";
import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import { cashMoney, cashPct, compactMoney } from "@/lib/cash";

const palette = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
  "#3b82f6",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#eab308",
  "#0ea5e9",
  "#22c55e",
  "#d946ef",
  "#f43f5e",
  "#0891b2",
  "#65a30d",
  "#7c3aed",
  "#059669",
  "#db2777",
  "#9333ea",
  "#0284c7",
];
export function cashColor(name: string) {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
export type CashSeries = {
  name: string;
  values: (number | null)[];
  color?: string;
};
export function CashPlot({
  periods,
  series,
  unit = "money",
  kind = "line",
  onPeriod,
  expandable = true,
}: {
  periods: string[];
  series: CashSeries[];
  unit?: "money" | "percent";
  kind?: "line" | "bar";
  onPeriod?: (period: string) => void;
  expandable?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [small, setSmall] = useState(false);
  const transform = small && unit === "money";
  useEffect(() => {
    if (!ref.current) return;
    const visible = series.filter((s) => !hidden.includes(s.name));
    const chart = new Chart(ref.current, {
      type: kind,
      data: {
        labels: periods,
        datasets: visible.map((s) => ({
          label: s.name,
          data: s.values.map((v) =>
            v === null
              ? null
              : transform
                ? Math.sign(v) * Math.log10(1 + Math.abs(v))
                : v,
          ),
          borderColor: s.color || cashColor(s.name),
          backgroundColor:
            (s.color || cashColor(s.name)) + (kind === "bar" ? "cc" : "18"),
          borderWidth: 2.5,
          pointRadius: periods.length > 24 ? 1 : 3,
          pointHoverRadius: 6,
          tension: 0.18,
          spanGaps: false,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        onClick: (_, points) => {
          if (points[0] && onPeriod) onPeriod(periods[points[0].index]);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = visible[ctx.datasetIndex].values[ctx.dataIndex];
                return `${ctx.dataset.label}: ${v === null ? "—" : unit === "percent" ? cashPct(v) : cashMoney(v)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              maxTicksLimit: 7,
              font: { size: 11 },
              callback: function (v) {
                const label = this.getLabelForValue(Number(v));
                return label.length === 7
                  ? `${label.slice(2, 4)}.${label.slice(5)}`
                  : label;
              },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: unit === "percent" ? 1 : undefined,
            grid: { color: "#e9edf5" },
            ticks: {
              maxTicksLimit: 5,
              font: { size: 11 },
              callback: (v) => {
                const raw = transform
                  ? Math.sign(Number(v)) * (10 ** Math.abs(Number(v)) - 1)
                  : Number(v);
                return unit === "percent"
                  ? cashPct(raw)
                  : Math.abs(raw) >= 100000000
                    ? `${(raw / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`
                    : compactMoney(raw);
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [periods, series, unit, hidden, transform, kind, onPeriod]);
  return (
    <div className="cash-plot">
      <div className="cash-plot-canvas">
        <canvas
          ref={ref}
          role="img"
          aria-label={`${series.map((s) => s.name).join(", ")} ${unit === "percent" ? "비중" : "금액"} 추이`}
        />
      </div>
      <div className="cash-plot-controls">
        <div className="cash-legend" aria-label="표시할 항목">
          {series.map((s) => (
            <button
              key={s.name}
              aria-pressed={!hidden.includes(s.name)}
              onClick={() =>
                setHidden(
                  hidden.includes(s.name)
                    ? hidden.filter((n) => n !== s.name)
                    : [...hidden, s.name],
                )
              }
            >
              <i style={{ background: s.color || cashColor(s.name) }} />
              {s.name}
            </button>
          ))}
        </div>
        {expandable && unit === "money" && (
          <button
            className="cash-scale"
            aria-pressed={small}
            onClick={() => setSmall(!small)}
          >
            작은값 확대 {small ? "켜짐" : "꺼짐"}
          </button>
        )}
      </div>
      {transform && (
        <p className="cash-note">
          0·음수를 보존하는 대칭 로그 축입니다. 금액은 툴팁과 표에서 확인하세요.
        </p>
      )}
    </div>
  );
}
