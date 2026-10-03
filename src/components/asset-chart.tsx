"use client";
import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import {
  ASSET_HIDDEN,
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
// 직전 기간 대비 증감률. 색은 국내 시세 관행(증가 빨강, 하락 파랑)이고 ▲▼를 함께 적는다.
// 직전 값이 없거나 0이면 비율이 없으므로 적지 않는다.
function changeMark(values: number[], i: number) {
  if (i < 1) return null;
  const rate = assetChangeRate(values[i] ?? 0, values[i - 1] ?? 0);
  if (rate === null) return null;
  const arrow = rate > 0 ? "▲" : rate < 0 ? "▼" : "";
  return {
    text: `${arrow}${Math.abs(rate * 100).toFixed(1)}%`,
    color: rate > 0 ? "#c4362f" : rate < 0 ? "#2f5fc4" : "#9aa392",
  };
}
// 막대로 그린다. 기본은 누적이라 총자산 증감이 바로 보이고,
// 작은 항목은 큰 항목에 눌려 변화가 안 보이므로 대칭 로그 축으로 펼치는 전환을 둔다.
export function AssetTrend({
  periods,
  series,
  onPoint,
  hide = false,
  unit = "직전",
}: {
  periods: string[];
  series: AssetSeries[];
  onPoint?: (period: string, key: string) => void;
  // 금액 가리기. 막대 높이는 그대로 두고 금액 라벨·축을 지우며, 툴팁은 그 기간 안의 비중으로 바꾼다.
  hide?: boolean;
  // 증감률을 무엇과 비교했는지. 월별은 "전월", 연별은 "전년".
  unit?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [expand, setExpand] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const visible = series.filter((s) => !hidden.includes(s.key));
    const symlog = (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v));
    const sumAt = (i: number) =>
      visible.reduce((n, s) => n + (s.values[i] ?? 0), 0);
    // 최신 막대 오른쪽에 항목별 비중과 직전 대비 증감률을 적는다. 모든 막대의 칸 안에 적으면
    // 막대 폭이 30px 안팎이라 글자가 겹친다. 다른 기간은 툴팁에서 같은 값을 본다.
    // 펼침 모드는 누적이 아니라 칸 위치가 비중과 맞지 않으므로 적지 않는다.
    const last = periods.length - 1;
    const latestTotal = last < 0 ? 0 : sumAt(last);
    const latest =
      expand || !latestTotal
        ? []
        : visible.flatMap((s, dataset) => {
            const value = s.values[last] ?? 0;
            if (value <= 0) return [];
            return [
              {
                dataset,
                key: s.key,
                name: s.name,
                share: assetPct(value / latestTotal),
                change: changeMark(s.values, last),
              },
            ];
          });
    const NAME_FONT = "600 10px system-ui";
    const VALUE_FONT = "700 10px system-ui";
    const GAP = 8;
    const LINE = 12;
    const DOT = 10;
    // 폭이 좁으면 이름을 빼고 색 점으로 대신한다. 이름은 아래 범례가 같은 색으로 보여준다.
    let withNames = true;
    const latestLabels = {
      id: "assetLatestLabels",
      beforeLayout(chart: Chart) {
        if (!latest.length) return;
        const { ctx } = chart;
        ctx.save();
        const width = (font: string, text: string) => {
          ctx.font = font;
          return ctx.measureText(text).width;
        };
        const tail = (l: (typeof latest)[number]) =>
          width(VALUE_FONT, l.share) +
          (l.change ? width(VALUE_FONT, ` ${l.change.text}`) : 0);
        const named = Math.max(
          ...latest.map((l) => width(NAME_FONT, `${l.name} `) + tail(l)),
        );
        const dotted = Math.max(...latest.map((l) => DOT + tail(l)));
        ctx.restore();
        withNames = named + GAP <= chart.width * 0.4;
        if (chart.options.layout)
          chart.options.layout.padding = {
            top: 16,
            right: Math.ceil((withNames ? named : dotted) + GAP + 2),
          };
      },
      afterDatasetsDraw(chart: Chart) {
        if (!latest.length) return;
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        // 아래 칸부터 자리를 잡는다. 앞 라벨과 겹치면 위로 밀고, 밀려서 제 칸을 벗어나면 적지 않는다.
        let above = Infinity;
        for (const label of latest) {
          const bar = chart.getDatasetMeta(label.dataset).data[last];
          if (!bar) continue;
          const { x, y, base, width } = bar.getProps(
            ["x", "y", "base", "width"],
            true,
          ) as { x: number; y: number; base: number; width: number };
          const top = Math.min(y, base);
          const at = Math.min((y + base) / 2, above - LINE);
          if (at < top - 1) continue;
          above = at;
          let left = x + width / 2 + GAP;
          if (withNames) {
            ctx.font = NAME_FONT;
            ctx.fillStyle = "#6b7464";
            const text = `${label.name} `;
            ctx.fillText(text, left, at);
            left += ctx.measureText(text).width;
          } else {
            ctx.fillStyle = assetColor(label.key);
            ctx.fillRect(left, at - 3.5, 7, 7);
            left += DOT;
          }
          ctx.font = VALUE_FONT;
          ctx.fillStyle = "#2f3a2f";
          ctx.fillText(label.share, left, at);
          left += ctx.measureText(label.share).width;
          if (label.change) {
            ctx.fillStyle = label.change.color;
            ctx.fillText(` ${label.change.text}`, left, at);
          }
        }
        ctx.restore();
      },
    };
    // 누적 막대 맨 위에 그 기간의 합산 금액을 적는다. 막대 높이만으로는 총자산이 얼마인지 못 읽는다.
    // 펼침 모드는 누적이 아니라 대칭 로그 축이라 합계를 그릴 자리가 없으므로 건너뛴다.
    const stackTotals = {
      id: "assetStackTotals",
      afterDatasetsDraw(chart: Chart) {
        if (hide || expand || !visible.length) return;
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
          const total = sumAt(i);
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
              label: (ctx) => {
                const { name, values } = visible[ctx.datasetIndex];
                const i = ctx.dataIndex;
                const sum = sumAt(i);
                const parts = [
                  assetPct(sum > 0 ? (values[i] ?? 0) / sum : null),
                ];
                if (!hide) parts.unshift(assetMoney(values[i] ?? 0));
                const change = changeMark(values, i);
                if (change) parts.push(`${unit} 대비 ${change.text}`);
                return `${name}: ${parts.join(" · ")}`;
              },
              footer: (items) =>
                hide || expand
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
              display: !hide,
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
      plugins: [stackTotals, latestLabels],
    });
    return () => chart.destroy();
  }, [periods, series, hidden, expand, onPoint, hide, unit]);
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
// 조각 위에 비중을 직접 적는다. 가운데는 작게 뚫어 그 시점의 총자산을 적는다.
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
// 구멍은 조각 라벨을 밀어내지 않을 만큼만 뚫는다. 총액은 두 줄로 적는다.
const centerTotal = (hide: boolean) => ({
  id: "assetCenterTotal",
  afterDatasetsDraw(chart: Chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const arc = meta.data[0] as unknown as
      { x: number; y: number; innerRadius: number } | undefined;
    if (!arc) return;
    const total = (chart.data.datasets[0].data as number[]).reduce(
      (n, v) => n + Number(v),
      0,
    );
    if (!total) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#7b8574";
    ctx.font = "600 9px system-ui";
    ctx.fillText("총자산", arc.x, arc.y - 9);
    ctx.fillStyle = "#2f3a2f";
    ctx.font = "700 14px system-ui";
    const text = hide ? ASSET_HIDDEN : assetCompact(total);
    // 구멍보다 글자가 넓으면 줄인다. 잘린 숫자는 없느니만 못하다.
    const room = arc.innerRadius * 1.8;
    if (ctx.measureText(text).width > room)
      ctx.font = `700 ${Math.max(9, Math.floor((14 * room) / ctx.measureText(text).width))}px system-ui`;
    ctx.fillText(text, arc.x, arc.y + 6);
    ctx.restore();
  },
});
export function AssetPie({
  rows,
  total,
  onSlice,
  hide = false,
}: {
  rows: { key: string; name: string; amount: number }[];
  total: number;
  onSlice?: (key: string) => void;
  hide?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = rows.filter((r) => r.amount > 0);
  useEffect(() => {
    if (!ref.current || !shown.length) return;
    const chart = new Chart(ref.current, {
      type: "doughnut",
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
              label: (ctx) => {
                const share = assetPct(total > 0 ? ctx.parsed / total : null);
                return hide
                  ? `${ctx.label}: ${share}`
                  : `${ctx.label}: ${assetMoney(ctx.parsed)} · ${share}`;
              },
            },
          },
        },
      },
      plugins: [shareLabels, centerTotal(hide)],
    });
    // chart.js의 설정 타입이 doughnut으로 좁혀지지 않아 구멍 크기는 생성 뒤에 지정한다.
    (chart.options as { cutout?: string }).cutout = "34%";
    chart.update("none");
    return () => chart.destroy();
  }, [shown, total, onSlice, hide]);
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
