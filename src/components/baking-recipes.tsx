"use client";
import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  bakingCategories,
  bakingRecipes,
  formatAmount,
  matchBakingRecipe,
  ovenTemps,
  recipeGrams,
} from "@/lib/baking";

// 취미 > 베이킹 레시피 목록. 검색어·분류는 URL(q, category)에 남겨 새로고침해도 유지한다.
export function BakingRecipeList({
  initialQuery = {},
  href,
}: {
  initialQuery?: Record<string, string>;
  href: (path: string) => string;
}) {
  const [query, setQuery] = useState(initialQuery.q ?? "");
  const [category, setCategory] = useState(initialQuery.category ?? "");
  const updateUrl = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  const categories = bakingCategories
    .map((c) => ({
      name: c,
      count: bakingRecipes.filter((r) => r.category === c).length,
    }))
    .filter((c) => c.count > 0);
  const shown = bakingRecipes.filter(
    (r) =>
      (!category || r.category === category) && matchBakingRecipe(r, query),
  );

  return (
    <div className="bk-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONO / HOBBY / BAKING</span>
          <h1>
            베이킹<span className="heading-dot">.</span>
          </h1>
          <p>레시피를 재료·오븐·공정별로 보고 배율에 맞춰 계량합니다.</p>
        </div>
      </div>

      <div className="bk-filter">
        <label className="bk-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder="레시피·재료 검색 (예: 레몬, 마스카포네)"
            aria-label="레시피·재료 검색"
            onChange={(e) => {
              setQuery(e.target.value);
              updateUrl("q", e.target.value.trim());
            }}
          />
        </label>
        <div className="bk-cats" role="group" aria-label="분류">
          {[{ name: "", count: bakingRecipes.length }, ...categories].map(
            (c) => (
              <button
                type="button"
                key={c.name || "all"}
                aria-pressed={category === c.name}
                onClick={() => {
                  setCategory(c.name);
                  updateUrl("category", c.name);
                }}
              >
                {c.name || "전체"} <small>{c.count}</small>
              </button>
            ),
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="bk-empty">
          조건에 맞는 레시피가 없어요. 검색어나 분류를 바꿔 보세요.
        </p>
      ) : (
        <section className="bk-list" aria-label="레시피 목록">
          {shown.map((r) => {
            return (
              <Link
                className="bk-card"
                key={r.id}
                href={href(`/hobby/baking/${r.id}`)}
              >
                <span className="bk-card-top">
                  <span className="bk-card-emoji" aria-hidden>
                    {r.emoji}
                  </span>
                  <span className="bk-category">{r.category}</span>
                </span>
                <strong>{r.name}</strong>
                <span className="bk-card-parts">
                  {r.parts.map((p) => p.name).join(" · ")}
                </span>
                <small>
                  {ovenTemps(r).join(" · ")} · {formatAmount(recipeGrams(r))}g
                  · {r.chips[0]}
                </small>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
