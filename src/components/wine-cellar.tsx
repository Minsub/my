"use client";
import { useState } from "react";
import Link from "next/link";
import { ProductArt } from "./product-art";
import {
  wineFacts,
  filterWines,
  champagne,
  type WineFilters,
} from "@/lib/wine-cellar";
import { wineTypes, type Snapshot, type Wine } from "@/lib/types";
import { money, vintageLabel, today } from "@/lib/format";
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
  function change(key: keyof WineFilters, value: string) {
    const next = {
      ...filters,
      [key]: value,
      ...(key === "country" ? { region: "" } : {}),
    };
    setFilters(next);
    const url = new URL(location.href);
    Object.entries(next).forEach(([k, v]) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k),
    );
    history.replaceState(null, "", url);
  }
  const all = data.wines.map((w) => wineFacts(w, data));
  const rows = filterWines(all, filters);
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
  const options = (key: "country" | "region" | "vintage") =>
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
          .map((w) =>
            key === "vintage"
              ? w.vintage_kind === "non_vintage"
                ? "NV"
                : w.vintage
                  ? String(w.vintage)
                  : ""
              : w[key],
          )
          .filter(Boolean),
      ),
    ).sort();
  const select = (key: "country" | "region" | "vintage", label: string) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={filters[key] || ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">전체</option>
        {options(key).map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
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
      <section className="cellar-dashboard" aria-label="셀러 대시보드">
        <div className="cellar-metrics">
          <div>
            <span>지금 우리 셀러</span>
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
            <span>이번 달 함께한 와인</span>
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
                    <span>{type === "스파클링" ? "기타 스파클링" : type}</span>
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
                ["score_desc", "가족 평점순"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details className="cellar-filters">
          <summary>상세 필터</summary>
          <div className="cellar-filter-grid">
            <label>
              와인 종류
              <select
                aria-label="와인 종류"
                value={filters.type || ""}
                onChange={(e) => change("type", e.target.value)}
              >
                <option value="">모든 종류</option>
                {[...wineTypes, "샴페인", "기타 스파클링"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            {select("country", "국가")}
            {select("region", "지역")}
            {select("vintage", "빈티지")}
            <label>
              품종
              <input
                value={filters.grape || ""}
                placeholder="예: 피노 누아"
                onChange={(e) => change("grape", e.target.value)}
              />
            </label>
            {(
              [
                ["min_price", "최소 구입가", "number"],
                ["max_price", "최대 구입가", "number"],
                ["from", "구입일 시작", "date"],
                ["to", "구입일 종료", "date"],
                ["min_score", "최소 가족 평점", "number"],
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
          {Object.entries(filters)
            .filter(([k, v]) => v && !["sort", "stock", "archived"].includes(k))
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
          <strong>
            {rows.length}종 · {rows.reduce((s, w) => s + w.stock, 0)}병
          </strong>
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
              setFilters({});
              const u = new URL(location.href);
              Object.keys(filters).forEach((k) => u.searchParams.delete(k));
              history.replaceState(null, "", u);
            }}
          >
            필터 초기화
          </button>
        </div>
      </section>
      <div className="cellar-list">
        {rows.map((w) => (
          <article key={w.id} className="cellar-row">
            <Link href={href(`/wine/${w.id}`)} className="cellar-product">
              <ProductArt
                kind="wine"
                name={w.name}
                imageUrl={
                  w.has_photo ? `/api/wine/${w.id}/photo?v=${w.version}` : null
                }
              />
              <div>
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
              </div>
            </Link>
            <div className="cellar-price">
              <strong>
                {w.price === null ? "가격 미입력" : money(w.price)}
              </strong>
              <small>
                병당 구입가{w.price_source === "import" ? " · 이관 기록" : ""}
              </small>
              <span>{w.purchased_on || "구입일 미입력"}</span>
              {w.score !== null && <span>가족 평점 {w.score}/100</span>}
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
      {!rows.length && (
        <div className="panel empty-state">
          <h2>조건에 맞는 와인이 없어요</h2>
          <p>재고 필터를 해제하거나 검색 조건을 바꿔보세요.</p>
        </div>
      )}
    </>
  );
}
