"use client";
import { Fragment, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import {
  bakingFoldKeys,
  bakingScales,
  combinedItems,
  formatAmount,
  partGrams,
  type BakingItem,
  type BakingPart,
  type BakingRecipe,
} from "@/lib/baking";

// 접은 상자는 이 브라우저에 기억한다. 서버 렌더는 모두 펼친 상태로 그리고,
// 하이드레이션 뒤 저장값으로 바꾼다(useSyncExternalStore의 서버 스냅샷).
const FOLD_KEY = "mono.baking.folds";
const FOLD_EVENT = "mono:baking-folds";
function readFoldRaw() {
  try {
    return window.localStorage.getItem(FOLD_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribeFolds(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(FOLD_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FOLD_EVENT, onChange);
  };
}
let memoryFolds = "[]";
function writeFolds(keys: string[]) {
  memoryFolds = JSON.stringify(keys);
  try {
    window.localStorage.setItem(FOLD_KEY, memoryFolds);
  } catch {
    // 저장소를 못 쓰는 창에서는 지금 화면에서만 접어 둔다.
  }
  window.dispatchEvent(new Event(FOLD_EVENT));
}
function parseFolds(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const partColors = ["var(--bk-p1)", "var(--bk-p2)", "var(--bk-p3)"];
export const partColor = (i: number) => partColors[i % partColors.length];

// {{메모}} → 손글씨, ~~값~~ → 지운 값, (?) → 읽기 어려운 글자
export function Rich({ text }: { text: string }) {
  const tokens = text.split(/(\{\{.+?\}\}|~~.+?~~|\(\?\))/);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("{{") && t.endsWith("}}"))
          return (
            <span className="bk-hand" key={i}>
              <Rich text={t.slice(2, -2)} />
            </span>
          );
        if (t.startsWith("~~") && t.endsWith("~~"))
          return (
            <s className="bk-strike" key={i}>
              {t.slice(2, -2)}
            </s>
          );
        if (t === "(?)")
          return (
            <span className="bk-unsure" key={i} title="사진으로 읽기 어려운 글자">
              (?)
            </span>
          );
        return <Fragment key={i}>{t}</Fragment>;
      })}
    </>
  );
}

function Amount({ item, scale }: { item: BakingItem; scale: number }) {
  if (item.qty == null)
    return (
      <span className="bk-qty">
        <Rich text={item.text ?? ""} />
      </span>
    );
  return (
    <span className="bk-qty">
      {formatAmount(item.qty * scale)}
      <small>{item.unit}</small>
      {scale !== 1 && (
        <em>
          원래 {formatAmount(item.qty)}
          {item.unit}
        </em>
      )}
    </span>
  );
}

function FoldHead({
  folded,
  onToggle,
  className = "",
  children,
}: {
  folded: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`bk-fold-head ${className}`}
      aria-expanded={!folded}
      onClick={onToggle}
    >
      {children}
      <ChevronDown className="bk-chev" size={18} aria-hidden />
    </button>
  );
}

export function BakingRecipeView({
  recipe,
  href,
}: {
  recipe: BakingRecipe;
  href: (path: string) => string;
}) {
  const [scale, setScale] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const foldRaw = useSyncExternalStore(
    subscribeFolds,
    () => {
      const raw = readFoldRaw();
      return raw === "[]" ? memoryFolds : raw;
    },
    () => "[]",
  );
  const folds = new Set(parseFolds(foldRaw));

  const foldId = (key: string) => `${recipe.id}:${key}`;
  const isFolded = (key: string) => folds.has(foldId(key));
  const toggleFold = (key: string) => {
    const next = new Set(folds);
    if (next.has(foldId(key))) next.delete(foldId(key));
    else next.add(foldId(key));
    writeFolds([...next]);
  };
  const keys = bakingFoldKeys(recipe);
  const allFolded = keys.every(isFolded);
  const setAllFolds = (fold: boolean) => {
    const next = new Set(folds);
    for (const key of keys) {
      if (fold) next.add(foldId(key));
      else next.delete(foldId(key));
    }
    writeFolds([...next]);
  };

  const toggleCheck = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const checkedHere = [...checked].filter((k) =>
    k.startsWith(recipe.id + ":"),
  ).length;
  const clearChecks = () =>
    setChecked(
      (prev) =>
        new Set([...prev].filter((k) => !k.startsWith(recipe.id + ":"))),
    );

  return (
    <div className="bk-page">
      <Link className="bk-back" href={href("/hobby/baking")}>
        <ArrowLeft size={16} />
        레시피 목록
      </Link>

      <section className="bk-hero">
        <span className="bk-category">{recipe.category}</span>
        <h1>
          <span aria-hidden>{recipe.emoji}</span> {recipe.name}
        </h1>
        <p className="bk-source">
          <Rich text={recipe.source} />
        </p>
        <div className="bk-chips">
          {recipe.chips.map((c) => (
            <span className="bk-chip" key={c}>
              {c}
            </span>
          ))}
        </div>
        <div className="bk-toolbar">
          <span className="bk-label">배율</span>
          <div className="bk-seg" role="group" aria-label="배율">
            {bakingScales.map((s) => (
              <button
                type="button"
                key={s}
                aria-pressed={s === scale}
                onClick={() => setScale(s)}
              >
                ×{s}
              </button>
            ))}
          </div>
          <span className="bk-spacer" />
          <button
            type="button"
            className="bk-link"
            onClick={() => setAllFolds(!allFolded)}
          >
            {allFolded ? "모두 펼치기" : "모두 접기"}
          </button>
          {checkedHere ? (
            <button type="button" className="bk-link" onClick={clearChecks}>
              계량 체크 {checkedHere}개 지우기
            </button>
          ) : (
            <span className="bk-label bk-faint">재료를 눌러 계량 체크</span>
          )}
        </div>
      </section>

      {recipe.parts.length > 1 && (
        <CombinedBox
          recipe={recipe}
          scale={scale}
          folded={isFolded("all")}
          onToggle={() => toggleFold("all")}
        />
      )}
      <OvenBox
        recipe={recipe}
        folded={isFolded("oven")}
        onToggle={() => toggleFold("oven")}
      />
      {recipe.parts.map((part, pi) => (
        <PartBox
          key={`${recipe.id}-${pi}`}
          recipe={recipe}
          part={part}
          index={pi}
          scale={scale}
          checked={checked}
          onCheck={toggleCheck}
          folded={isFolded(`part-${pi}`)}
          onToggle={() => toggleFold(`part-${pi}`)}
        />
      ))}
      {recipe.notes.length > 0 && (
        <section className={`bk-box${isFolded("notes") ? " folded" : ""}`}>
          <FoldHead
            folded={isFolded("notes")}
            onToggle={() => toggleFold("notes")}
          >
            <span className="bk-box-title">📝 메모 · 보관</span>
            <span className="bk-fold-summary">{recipe.notes.length}개</span>
          </FoldHead>
          <div className="bk-fold-body">
            <ul className="bk-notes">
              {recipe.notes.map((n) => (
                <li key={n}>
                  <Rich text={n} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="bk-legend">
        <span>
          <span className="bk-hand">손글씨</span> 수업 자료 위 메모
        </span>
        <span>
          <span className="bk-unsure">(?)</span> 사진으로 읽기 어려운 글자
        </span>
      </div>
    </div>
  );
}

function CombinedBox({
  recipe,
  scale,
  folded,
  onToggle,
}: {
  recipe: BakingRecipe;
  scale: number;
  folded: boolean;
  onToggle: () => void;
}) {
  const rows = combinedItems(recipe);
  const total = rows.reduce((sum, x) => sum + x.grams, 0);
  const hasEggCount = recipe.parts.some((p) =>
    p.items.some((it) => it.unit === "개"),
  );
  return (
    <section className={`bk-box${folded ? " folded" : ""}`}>
      <FoldHead folded={folded} onToggle={onToggle} className="bk-wrap-head">
        <span className="bk-box-title">🧺 전체 재료 · {rows.length}가지</span>
        <span className="bk-part-legend">
          {recipe.parts.map((p, i) => (
            <span key={p.name}>
              <i style={{ background: partColor(i) }} />
              {p.name}
            </span>
          ))}
        </span>
      </FoldHead>
      <div className="bk-fold-body">
        <ul className="bk-all">
          {rows.map((row) => (
            <li key={`${row.name}-${row.unit ?? row.from[0].part}`}>
              <div className="bk-line">
                <strong className="bk-ing-name">{row.name}</strong>
                <span className="bk-leader" aria-hidden />
                {row.from.some((f) => f.qty != null) ? (
                  <span className="bk-qty">
                    {formatAmount(row.qty * scale)}
                    <small>{row.unit}</small>
                  </span>
                ) : (
                  <span className="bk-qty">
                    <Rich text={row.text ?? ""} />
                  </span>
                )}
              </div>
              <div className="bk-split">
                {row.from.map((f, i) => (
                  <span key={i}>
                    <i style={{ background: partColor(f.part) }} />
                    {recipe.parts[f.part].name}
                    {(row.from.length > 1 || f.qty == null) && (
                      <>
                        {" "}
                        {f.qty != null ? (
                          `${formatAmount(f.qty * scale)}${row.unit}`
                        ) : (
                          <Rich text={f.text ?? ""} />
                        )}
                      </>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="bk-all-foot">
          전체 무게 <b>{formatAmount(total * scale)}g</b>
          {hasEggCount && " (계란은 개당 60g으로 셈)"}
        </p>
      </div>
    </section>
  );
}

function OvenBox({
  recipe,
  folded,
  onToggle,
}: {
  recipe: BakingRecipe;
  folded: boolean;
  onToggle: () => void;
}) {
  const maxMin = Math.max(...recipe.ovens.map((o) => o.max ?? o.min));
  const scaleMax = Math.ceil(maxMin / 10) * 10 || 10;
  const temps = [...new Set(recipe.ovens.map((o) => `${o.temp}℃`))];
  const notes = recipe.ovens.filter((o) => o.note);
  return (
    <section className={`bk-box${folded ? " folded" : ""}`}>
      <FoldHead folded={folded} onToggle={onToggle}>
        <span className="bk-box-title">🔥 오븐</span>
        <span className="bk-fold-summary">
          {temps.join(" · ")} · {recipe.ovens.length}번 굽기
        </span>
      </FoldHead>
      <div className="bk-fold-body">
        {recipe.ovens.map((o) => {
          const end = o.max ?? o.min;
          return (
            <div className="bk-oven-row" key={o.what}>
              <span className="bk-oven-what">{o.what}</span>
              <div className="bk-oven-track">
                <div
                  className="bk-oven-fill"
                  style={{ width: `max(${(end / scaleMax) * 100}%, 96px)` }}
                >
                  {o.max && (
                    <span
                      className="bk-oven-range"
                      style={{ width: `${((o.max - o.min) / end) * 100}%` }}
                    />
                  )}
                  <span className="bk-oven-text">
                    {o.temp}℃ · {o.max ? `${o.min}~${o.max}` : o.min}분
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="bk-oven-row bk-oven-ticks">
          <span />
          <div>
            <span>0분</span>
            <span>{formatAmount(scaleMax / 2)}분</span>
            <span>{scaleMax}분</span>
          </div>
        </div>
        {notes.length > 0 && (
          <p className="bk-oven-note">
            {notes.map((o) => `${o.what}: ${o.note}`).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

function PartBox({
  recipe,
  part,
  index,
  scale,
  checked,
  onCheck,
  folded,
  onToggle,
}: {
  recipe: BakingRecipe;
  part: BakingPart;
  index: number;
  scale: number;
  checked: Set<string>;
  onCheck: (key: string) => void;
  folded: boolean;
  onToggle: () => void;
}) {
  const total = partGrams(part);
  return (
    <section className={`bk-box bk-part${folded ? " folded" : ""}`}>
      <FoldHead folded={folded} onToggle={onToggle} className="bk-part-head">
        <span className="bk-part-title">
          {recipe.parts.length > 1 && (
            <span className="bk-num" style={{ background: partColor(index) }}>
              {index + 1}
            </span>
          )}
          {part.name}
        </span>
        {total > 0 && (
          <span className="bk-part-total">
            합계 <b>{formatAmount(total * scale)}g</b>
          </span>
        )}
      </FoldHead>
      <div className="bk-part-body bk-fold-body">
        <div className="bk-col">
          <h3 className="bk-col-title">재료</h3>
          <ul className="bk-ing">
            {part.items.map((item, ii) => {
              const key = `${recipe.id}:${index}:${ii}`;
              const done = checked.has(key);
              return (
                <li key={key} className={done ? "done" : ""}>
                  <button
                    type="button"
                    className="bk-ing-row"
                    aria-pressed={done}
                    onClick={() => onCheck(key)}
                  >
                    <span className="bk-check" aria-hidden>
                      {done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="bk-line">
                      <span className="bk-ing-name">{item.name}</span>
                      <span className="bk-leader" aria-hidden />
                      <Amount item={item} scale={scale} />
                    </span>
                  </button>
                  {item.note && (
                    <p className="bk-ing-note">
                      <Rich text={item.note} />
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="bk-col">
          <h3 className="bk-col-title">만드는 법</h3>
          <ol className="bk-steps">
            {part.steps.map((s, si) => (
              <li key={si}>
                <span className="bk-dot">{si + 1}</span>
                {s.title && <strong>{s.title} </strong>}
                <Rich text={s.text} />
                {(s.heat || s.badges) && (
                  <div className="bk-badges">
                    {s.heat && (
                      <span className="bk-chip bk-heat">🔥 {s.heat}</span>
                    )}
                    {s.badges?.map((b) => (
                      <span className="bk-chip" key={b}>
                        <Rich text={b} />
                      </span>
                    ))}
                  </div>
                )}
                {s.sub && (
                  <ul className="bk-sub">
                    {s.sub.map((x) => (
                      <li key={x}>
                        <Rich text={x} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {part.notes && (
            <ul className="bk-notes">
              {part.notes.map((n) => (
                <li key={n}>
                  <Rich text={n} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
