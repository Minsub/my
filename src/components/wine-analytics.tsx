import type { Snapshot } from "@/lib/types";
import { today } from "@/lib/format";

export function WineAnalytics({ data }: { data: Snapshot }) {
  const countries = new Map<string, number>();
  for (const wine of data.wines) {
    if (wine.stock > 0)
      countries.set(
        wine.country || "나라 미입력",
        (countries.get(wine.country || "나라 미입력") ?? 0) + wine.stock,
      );
  }
  const sorted = [...countries].sort((a, b) => b[1] - a[1]);
  const countryMax = Math.max(1, ...countries.values());
  const reversed = new Set(
    data.events.map((event) => event.reverses_id).filter(Boolean),
  );
  const [year, month] = today().split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = date.toISOString().slice(0, 7);
    const count = data.events
      .filter(
        (event) =>
          event.kind === "consume" &&
          !reversed.has(event.id) &&
          event.occurred_on.startsWith(key),
      )
      .reduce((sum, event) => sum - event.delta, 0);
    return { key, label: `${date.getUTCMonth() + 1}월`, count };
  });
  const monthMax = Math.max(1, ...months.map((month) => month.count));
  return (
    <div className="analytics-grid">
      <section className="panel distribution">
        <div className="section-heading compact">
          <h2>나라별 컬렉션</h2>
          <span className="muted small">현재 보유 병수</span>
        </div>
        {sorted.length ? (
          sorted.map(([country, count]) => (
            <div className="bar-row" key={country}>
              <span>{country}</span>
              <div>
                <i style={{ width: `${(count / countryMax) * 100}%` }} />
              </div>
              <strong>{count}병</strong>
            </div>
          ))
        ) : (
          <p className="muted">입고한 와인이 있으면 표시해요.</p>
        )}
      </section>
      <section className="panel distribution">
        <div className="section-heading compact">
          <h2>함께 나눈 와인</h2>
          <span className="muted small">최근 6개월</span>
        </div>
        <div
          className="month-chart"
          role="img"
          aria-label={months
            .map((month) => `${month.key} ${month.count}병 소비`)
            .join(", ")}
        >
          {months.map((month) => (
            <div key={month.key}>
              <strong>{month.count}병</strong>
              <div className="month-track">
                <i style={{ height: `${(month.count / monthMax) * 100}%` }} />
              </div>
              <span>{month.label}</span>
            </div>
          ))}
        </div>
        <p className="muted small">
          소비한 날짜 기준 · 취소한 기록은 제외해요.
        </p>
      </section>
    </div>
  );
}
