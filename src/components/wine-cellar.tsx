"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, List, Maximize2, X } from "lucide-react";
import Link from "next/link";
import { ProductArt } from "./product-art";
import {
  wineFacts,
  filterWines,
  champagne,
  grapeList,
  type WineFilters,
} from "@/lib/wine-cellar";
import { wineTypes, type Snapshot, type Wine } from "@/lib/types";
import { money, vintageLabel, today } from "@/lib/format";
// 목록 썸네일과 같은 주소라 이미 받은 사진은 브라우저 캐시에서 연다.
const photoUrl = (w: Wine) => `/api/wine/${w.id}/photo?v=${w.version}`;
const typeColor: Record<string, string> = {
  레드: "#8c2f45",
  화이트: "#d6b85a",
  로제: "#e597a4",
  스파클링: "#a9b86b",
  디저트: "#c98a3c",
  주정강화: "#6b3a2a",
};
// 결과 줄 합계는 정확한 원 단위, 모바일 대시보드 요약 한 줄은 만원 단위로 줄인다.
const manwon = (n: number) =>
  n >= 10000
    ? `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`
    : money(n);
// 가격 구간 칩. 필터의 최소·최대가 모두 포함(이상·이하)이라 경계 값이 두 칸에 겹치지 않게 1원 아래로 끊는다.
const priceBands = [
  { label: "3만 미만", min: "", max: "29999" },
  { label: "3–5만", min: "30000", max: "49999" },
  { label: "5–10만", min: "50000", max: "99999" },
  { label: "10만 이상", min: "100000", max: "" },
];
const shiftMonths = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
function datePresets() {
  const now = today(),
    year = Number(now.slice(0, 4));
  return [
    { label: "최근 3개월", from: shiftMonths(now, -3), to: "" },
    { label: "올해", from: `${year}-01-01`, to: "" },
    { label: "작년", from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  ];
}
function WinePhotoViewer({
  wine,
  onClose,
}: {
  wine: Wine;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="cellar-viewer"
      aria-label={`${wine.name} 사진`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        autoFocus
        className="cellar-viewer-close"
        aria-label="닫기"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- 인증 라우트의 사진을 그대로 표시한다. */}
      <img src={photoUrl(wine)} alt={`${wine.name} 사진`} />
    </dialog>
  );
}
// 상세 화면의 세로 사진. 누르면 전체 화면으로 연다.
export function WineDetailPhoto({ wine }: { wine: Wine }) {
  const [open, setOpen] = useState(false);
  const art = (
    <ProductArt
      kind="wine"
      name={wine.name}
      large
      imageUrl={wine.has_photo ? photoUrl(wine) : null}
    />
  );
  return (
    <div className="wine-detail-photo">
      {wine.has_photo ? (
        <button
          type="button"
          aria-label={`${wine.name} 사진 크게 보기`}
          onClick={() => setOpen(true)}
        >
          {art}
          <span aria-hidden>
            <Maximize2 size={15} />
          </span>
        </button>
      ) : (
        art
      )}
      {open && <WinePhotoViewer wine={wine} onClose={() => setOpen(false)} />}
    </div>
  );
}
export function WineCellar({
  data,
  initialQuery,
  href,
  receive,
  consume,
}: {
  data: Snapshot;
  initialQuery: WineFilters;
  href: (url: string) => string;
  receive: (w: Wine) => void;
  consume: (w: Wine) => void;
}) {
  const [filters, setFilters] = useState<WineFilters>(initialQuery);
  const [photo, setPhoto] = useState<Wine | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const view = filters.view === "list" ? "list" : "grid";
  function update(patch: WineFilters) {
    const next = {
      ...filters,
      ...patch,
      ...("country" in patch ? { region: "" } : {}),
    };
    setFilters(next);
    const url = new URL(location.href);
    Object.entries(next).forEach(([k, v]) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k),
    );
    history.replaceState(null, "", url);
  }
  const change = (key: keyof WineFilters, value: string) =>
    update({ [key]: value });
  const all = data.wines.map((w) => wineFacts(w, data));
  const rows = filterWines(all, filters);
  // 칩 옆 숫자: 다른 조건은 그대로 두고 그 칩만 바꿨을 때 남는 와인 종 수.
  const facet = (patch: WineFilters) =>
    filterWines(all, { ...filters, ...patch }).length;
  const resultBottles = rows.reduce((s, w) => s + w.stock, 0);
  const resultPriced = rows.filter((w) => w.price !== null && w.stock > 0),
    resultPricedBottles = resultPriced.reduce((s, w) => s + w.stock, 0),
    resultValue = resultPriced.reduce((s, w) => s + w.price! * w.stock, 0);
  const presets = datePresets();
  const priceBand = priceBands.find(
    (b) =>
      b.min === (filters.min_price || "") &&
      b.max === (filters.max_price || ""),
  );
  const datePreset = presets.find(
    (p) => p.from === (filters.from || "") && p.to === (filters.to || ""),
  );
  const held = all.filter((w) => !w.archived && w.stock > 0),
    bottles = held.reduce((s, w) => s + w.stock, 0);
  const valued = held.filter((w) => w.price !== null),
    pricedBottles = valued.reduce((s, w) => s + w.stock, 0);
  const countries = Object.entries(
    held.reduce<Record<string, number>>((acc, w) => {
      const key = w.country || "나라 미입력";
      acc[key] = (acc[key] || 0) + w.stock;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  type OptionKey = "country" | "region" | "vintage" | "grape";
  const options = (key: OptionKey) =>
    Array.from(
      new Set(
        all
          .filter(
            (w) =>
              !w.archived &&
              (key !== "region" ||
                !filters.country ||
                w.country === filters.country),
          )
          .flatMap((w) =>
            key === "vintage"
              ? w.vintage_kind === "non_vintage"
                ? "NV"
                : w.vintage
                  ? String(w.vintage)
                  : ""
              : key === "grape"
                ? grapeList(w.grapes)
                : w[key],
          )
          .filter(Boolean),
      ),
    ).sort();
  const select = (key: OptionKey, label: string) => {
    const current = filters[key] || "",
      list = options(key);
    return (
      <label>
        {label}
        <select
          aria-label={label}
          value={current}
          onChange={(e) => change(key, e.target.value)}
        >
          <option value="">전체</option>
          {(current && !list.includes(current) ? [current, ...list] : list).map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
      </label>
    );
  };
  const reversed = new Set(data.events.map((e) => e.reverses_id));
  const month = today().slice(0, 7);
  const consumed = data.events
    .filter(
      (e) =>
        e.kind === "consume" &&
        e.occurred_on.startsWith(month) &&
        !reversed.has(e.id),
    )
    .reduce((s, e) => s - e.delta, 0);
  return (
    <>
      <section
        className="cellar-dashboard"
        aria-label="셀러 대시보드"
        data-open={summaryOpen}
      >
        <button
          type="button"
          className="cellar-summary"
          aria-expanded={summaryOpen}
          onClick={() => setSummaryOpen(!summaryOpen)}
        >
          <span>
            보유 <b>{bottles}병</b>
          </span>
          <span>
            추정{" "}
            <b>{manwon(valued.reduce((s, w) => s + w.price! * w.stock, 0))}</b>
          </span>
          <span>
            이번 달 <b>{consumed}병</b>
          </span>
          <ChevronDown size={16} aria-hidden />
        </button>
        <div className="cellar-dashboard-body">
          <div className="cellar-metrics">
            <div>
              <span>현재 보유</span>
              <strong>
                {bottles}
                <small> 병</small>
              </strong>
              <p>
                {held.length}종 · {countries.length}개 원산지
              </p>
            </div>
            <div>
              <span>구입가 기준 추정 가치</span>
              <strong>
                {money(valued.reduce((s, w) => s + w.price! * w.stock, 0))}
              </strong>
              <p>
                {pricedBottles}/{bottles}병 가격 확인 · 현재 재고 × 최근 구입가
              </p>
            </div>
            <div>
              <span>이번 달 소비</span>
              <strong>
                {consumed}
                <small> 병</small>
              </strong>
              <p>취소된 소비 기록 제외</p>
            </div>
          </div>
          <div className="cellar-breakdown">
            <div>
              <h2>종류별 보유</h2>
              <div className="cellar-types">
                {[...wineTypes, "샴페인"].map((type) => {
                  const count = held
                    .filter((w) =>
                      type === "샴페인"
                        ? champagne(w)
                        : type === "스파클링"
                          ? w.type === type && !champagne(w)
                          : w.type === type,
                    )
                    .reduce((s, w) => s + w.stock, 0);
                  return (
                    <button
                      key={type}
                      onClick={() =>
                        change(
                          "type",
                          type === "스파클링" ? "기타 스파클링" : type,
                        )
                      }
                      aria-pressed={
                        filters.type ===
                        (type === "스파클링" ? "기타 스파클링" : type)
                      }
                    >
                      <span>
                        {type === "스파클링" ? "기타 스파클링" : type}
                      </span>
                      <strong>
                        {count}
                        <small>병</small>
                      </strong>
                    </button>
                  );
                })}
              </div>
              <p className="muted small">
                샴페인은 프랑스 샹파뉴 지역의 스파클링으로 구분합니다.
              </p>
            </div>
            <div>
              <h2>국가별 보유</h2>
              <div className="cellar-countries">
                {countries.length ? (
                  countries.map(([country, n]) => (
                    <button
                      key={country}
                      aria-pressed={
                        !!filters.country && filters.country === country
                      }
                      onClick={() =>
                        change(
                          "country",
                          country === "나라 미입력" ? "" : country,
                        )
                      }
                    >
                      <span>{country}</span>
                      <i style={{ width: `${(n / bottles) * 100}%` }} />
                      <strong>{n}병</strong>
                    </button>
                  ))
                ) : (
                  <p className="muted">입고한 와인이 여기에 표시됩니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="cellar-controls" aria-label="와인 검색 조건">
        <div className="cellar-search">
          <input
            aria-label="와인 검색"
            placeholder="이름, 생산자, 지역, 품종 검색"
            value={filters.q || ""}
            onChange={(e) => change("q", e.target.value)}
          />
          <label>
            정렬
            <select
              aria-label="와인 정렬"
              value={filters.sort || "added_desc"}
              onChange={(e) => change("sort", e.target.value)}
            >
              {[
                ["added_desc", "최근 등록순"],
                ["price_asc", "가격 낮은순"],
                ["price_desc", "가격 높은순"],
                ["date_desc", "최근 구입순"],
                ["date_asc", "오래된 구입순"],
                ["name_asc", "이름순"],
                ["vintage_asc", "오래된 빈티지순"],
                ["stock_desc", "보유 병수순"],
                ["score_desc", "사용자 평점순"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cellar-chips" aria-label="빠른 필터">
          <div role="group" aria-label="종류">
            <span>종류</span>
            <div>
              <button
                type="button"
                aria-pressed={!filters.type}
                onClick={() => change("type", "")}
              >
                전체
              </button>
              {wineTypes
                .flatMap((t) =>
                  t === "스파클링" ? ["샴페인", "기타 스파클링"] : t,
                )
                .map((t) => [t, facet({ type: t })] as const)
                .filter(([t, n]) => n || filters.type === t)
                .map(([t, n]) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={filters.type === t}
                    onClick={() => change("type", filters.type === t ? "" : t)}
                  >
                    {t} <small>{n}</small>
                  </button>
                ))}
            </div>
          </div>
          <div role="group" aria-label="국가">
            <span>국가</span>
            <div>
              <button
                type="button"
                aria-pressed={!filters.country}
                onClick={() => change("country", "")}
              >
                전체
              </button>
              {options("country")
                .map((c) => [c, facet({ country: c, region: "" })] as const)
                .filter(([c, n]) => n || filters.country === c)
                .sort((a, b) => b[1] - a[1])
                .map(([c, n]) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={filters.country === c}
                    onClick={() =>
                      change("country", filters.country === c ? "" : c)
                    }
                  >
                    {c} <small>{n}</small>
                  </button>
                ))}
            </div>
          </div>
          <div role="group" aria-label="가격">
            <span>가격</span>
            <div>
              <button
                type="button"
                aria-pressed={!filters.min_price && !filters.max_price}
                onClick={() => update({ min_price: "", max_price: "" })}
              >
                전체
              </button>
              {priceBands.map((b) => (
                <button
                  type="button"
                  key={b.label}
                  aria-pressed={priceBand === b}
                  onClick={() =>
                    priceBand === b
                      ? update({ min_price: "", max_price: "" })
                      : update({ min_price: b.min, max_price: b.max })
                  }
                >
                  {b.label}{" "}
                  <small>{facet({ min_price: b.min, max_price: b.max })}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
        <details className="cellar-filters">
          <summary>상세 필터</summary>
          <div className="cellar-presets" role="group" aria-label="구입 시기">
            <span>구입 시기</span>
            {presets.map((p) => (
              <button
                type="button"
                key={p.label}
                aria-pressed={datePreset === p}
                onClick={() =>
                  datePreset === p
                    ? update({ from: "", to: "" })
                    : update({ from: p.from, to: p.to })
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="cellar-filter-grid">
            {select("region", "지역")}
            {select("vintage", "빈티지")}
            {select("grape", "품종")}
            {(
              [
                ["min_price", "최소 구입가", "number"],
                ["max_price", "최대 구입가", "number"],
                ["from", "구입일 시작", "date"],
                ["to", "구입일 종료", "date"],
                ["min_score", "최소 사용자 평점", "number"],
              ] as const
            ).map(([k, label, type]) => (
              <label key={k}>
                {label}
                <input
                  type={type}
                  min="0"
                  max={k === "min_score" ? 100 : undefined}
                  value={filters[k] || ""}
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </details>
        <div className="cellar-active-filters" aria-label="적용된 필터">
          {priceBand && (
            <button onClick={() => update({ min_price: "", max_price: "" })}>
              가격: {priceBand.label} ×
            </button>
          )}
          {datePreset && (
            <button onClick={() => update({ from: "", to: "" })}>
              구입: {datePreset.label} ×
            </button>
          )}
          {Object.entries(filters)
            .filter(
              ([k, v]) =>
                v &&
                !["sort", "stock", "archived", "view"].includes(k) &&
                !(priceBand && ["min_price", "max_price"].includes(k)) &&
                !(datePreset && ["from", "to"].includes(k)),
            )
            .map(([k, v]) => (
              <button
                key={k}
                onClick={() => change(k as keyof WineFilters, "")}
              >
                {
                  (
                    {
                      q: "검색",
                      type: "종류",
                      country: "국가",
                      region: "지역",
                      grape: "품종",
                      vintage: "빈티지",
                      min_price: "최소 가격",
                      max_price: "최대 가격",
                      from: "구입 시작",
                      to: "구입 종료",
                      min_score: "최소 평점",
                    } as Record<string, string>
                  )[k]
                }
                : {v} ×
              </button>
            ))}
        </div>
        <div className="cellar-results">
          <div className="cellar-total">
            <strong>
              {rows.length}종 · {resultBottles}병
            </strong>
            {resultPricedBottles > 0 && (
              <span>
                합계 <b>{money(resultValue)}</b> · 병당 평균{" "}
                {money(Math.round(resultValue / resultPricedBottles))}
                {resultPricedBottles < resultBottles &&
                  ` · ${resultBottles - resultPricedBottles}병 가격 미입력`}
              </span>
            )}
          </div>
          <label>
            <input
              type="checkbox"
              checked={filters.stock !== "all"}
              onChange={(e) => change("stock", e.target.checked ? "" : "all")}
            />{" "}
            재고 있는 와인만
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.archived === "true"}
              onChange={(e) => change("archived", String(e.target.checked))}
            />{" "}
            보관함
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFilters(filters.view ? { view: filters.view } : {});
              const u = new URL(location.href);
              Object.keys(filters)
                .filter((k) => k !== "view")
                .forEach((k) => u.searchParams.delete(k));
              history.replaceState(null, "", u);
            }}
          >
            필터 초기화
          </button>
          <div className="cellar-view" role="group" aria-label="보기 방식">
            <button
              type="button"
              aria-label="사진 크게 보기"
              aria-pressed={view === "grid"}
              onClick={() => change("view", "")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              aria-label="목록으로 보기"
              aria-pressed={view === "list"}
              onClick={() => change("view", "list")}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </section>
      {view === "grid" ? (
        <div className="cellar-gallery">
          {rows.map((w) => (
            <article
              key={w.id}
              className={`cellar-card${w.stock ? "" : " is-empty"}`}
            >
              <div className="cellar-card-photo">
                <Link href={href(`/wine/${w.id}`)} tabIndex={-1} aria-hidden>
                  <ProductArt
                    kind="wine"
                    name={w.name}
                    imageUrl={w.has_photo ? photoUrl(w) : null}
                  />
                </Link>
                <span className="cellar-card-stock">
                  {w.stock ? `${w.stock}병` : "재고 없음"}
                </span>
                {w.has_photo && (
                  <button
                    type="button"
                    className="cellar-card-zoom"
                    aria-label={`${w.name} 사진 크게 보기`}
                    onClick={() => setPhoto(w)}
                  >
                    <Maximize2 size={15} />
                  </button>
                )}
              </div>
              <Link href={href(`/wine/${w.id}`)} className="cellar-card-info">
                <small>
                  <i style={{ background: typeColor[w.type] ?? "#a99" }} />
                  {w.type} · {vintageLabel(w)}
                </small>
                <h3>{w.name}</h3>
                {w.english_name && <p>{w.english_name}</p>}
                <span>
                  {[w.country, w.region].filter(Boolean).join(" · ") ||
                    "원산지 미입력"}
                </span>
              </Link>
              <div className="cellar-card-foot">
                <strong>
                  {w.price === null ? "가격 미입력" : money(w.price)}
                </strong>
                {w.score !== null && <span>평점 {w.score}</span>}
              </div>
              <div className="cellar-card-actions">
                <button
                  className="button secondary small-button"
                  onClick={() => receive(w)}
                >
                  입고
                </button>
                <button
                  className="button primary small-button"
                  disabled={!w.stock}
                  onClick={() => consume(w)}
                >
                  소비
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cellar-list">
          {rows.map((w) => (
            <article key={w.id} className="cellar-row">
              <div className="cellar-product">
                {w.has_photo ? (
                  <button
                    type="button"
                    className="cellar-photo"
                    aria-label={`${w.name} 사진 크게 보기`}
                    onClick={() => setPhoto(w)}
                  >
                    <ProductArt
                      kind="wine"
                      name={w.name}
                      imageUrl={photoUrl(w)}
                    />
                  </button>
                ) : (
                  <Link href={href(`/wine/${w.id}`)} tabIndex={-1} aria-hidden>
                    <ProductArt kind="wine" name={w.name} />
                  </Link>
                )}
                <Link href={href(`/wine/${w.id}`)} className="cellar-info">
                  <small>
                    NO. {w.display_id} · {w.type} · {vintageLabel(w)}
                  </small>
                  <h3>{w.name}</h3>
                  <p>{w.english_name}</p>
                  <p>
                    {[w.country, w.region].filter(Boolean).join(" · ") ||
                      "원산지 미입력"}
                  </p>
                  <span>{w.grapes}</span>
                </Link>
              </div>
              <div className="cellar-price">
                <strong>
                  {w.price === null ? "가격 미입력" : money(w.price)}
                </strong>
                <small>
                  병당 구입가{w.price_source === "import" ? " · 이관 기록" : ""}
                </small>
                <span>{w.purchased_on || "구입일 미입력"}</span>
                {w.score !== null && <span>사용자 평점 {w.score}/100</span>}
              </div>
              <div className="cellar-stock">
                <strong>
                  {w.stock} <small>병</small>
                </strong>
                <div>
                  <button
                    className="button secondary small-button"
                    onClick={() => receive(w)}
                  >
                    입고
                  </button>
                  <button
                    className="button primary small-button"
                    disabled={!w.stock}
                    onClick={() => consume(w)}
                  >
                    소비
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {photo && <WinePhotoViewer wine={photo} onClose={() => setPhoto(null)} />}
      {!rows.length && (
        <div className="panel empty-state">
          <h2>조건에 맞는 와인이 없어요</h2>
          <p>재고 필터를 해제하거나 검색 조건을 바꿔보세요.</p>
        </div>
      )}
    </>
  );
}
