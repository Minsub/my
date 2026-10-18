"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  LoaderCircle,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  CELLAR_SHELF_CAPACITY,
  CELLAR_SHELVES,
  shelfTotals,
  winePlacement,
  wineTypeColor,
  champagne,
  type ShelfCount,
} from "@/lib/wine-cellar";
import type { Operation } from "@/lib/contracts";
import type { Snapshot, Wine } from "@/lib/types";
import { vintageLabel } from "@/lib/format";
type Save = (op: Operation, input: Record<string, unknown>) => Promise<void>;
// 1층이 맨 아래라 화면에는 위에서부터 14층 → 1층으로 그린다.
const shelvesTopDown = Array.from(
  { length: CELLAR_SHELVES },
  (_, i) => CELLAR_SHELVES - i,
);
const photoUrl = (w: Wine) => `/api/wine/${w.id}/photo?v=${w.version}`;
function Bottle({ wine }: { wine: Wine }) {
  return (
    <span
      className="cellar-bottle-face"
      style={
        {
          "--bottle": wineTypeColor[wine.type] ?? "#68725f",
        } as React.CSSProperties
      }
    >
      {wine.has_photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(wine)} alt="" loading="lazy" />
      ) : (
        <b>{wine.name.slice(0, 2)}</b>
      )}
    </span>
  );
}
// 셀러 안에서는 뉘어 둔 병의 바닥(둥근 면)만 보인다. 종류는 색, 스파클링은 기포 점, 샴페인은 금색 테로 구분한다.
const bottleKinds = [
  { key: "red", label: "레드" },
  { key: "white", label: "화이트" },
  { key: "rose", label: "로제" },
  { key: "champagne", label: "샴페인" },
  { key: "sparkling", label: "스파클링" },
  { key: "dessert", label: "디저트" },
  { key: "fortified", label: "주정강화" },
] as const;
type BottleKind = (typeof bottleKinds)[number]["key"];
const kindOf = (w: Wine): BottleKind =>
  champagne(w)
    ? "champagne"
    : ((
        {
          레드: "red",
          화이트: "white",
          로제: "rose",
          스파클링: "sparkling",
          디저트: "dessert",
          주정강화: "fortified",
        } as const
      )[w.type as "레드"] ?? "red");
function BottleEnd({ kind }: { kind: BottleKind }) {
  return (
    <span className={`bottle-end k-${kind}`} aria-hidden>
      <span className="bottle-punt" />
      {(kind === "sparkling" || kind === "champagne") && (
        <span className="bottle-bubbles">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
// 한 와인의 위치를 바꿔 저장한다. 화면에서 본 위치를 expected_placements로 보내 그 사이 변경을 막는다.
function placementInput(
  wine: Wine,
  data: Snapshot,
  next: ShelfCount[],
): Record<string, unknown> {
  return {
    idempotency_key: crypto.randomUUID(),
    wine_id: wine.id,
    expected_placements: winePlacement(wine, data.placements).shelves,
    placements: next
      .filter((p) => p.quantity > 0)
      .sort((a, b) => a.shelf - b.shelf),
  };
}
function Sheet({
  title,
  eyebrow,
  onClose,
  busy,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog cellar-sheet"
      aria-labelledby="cellar-sheet-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="cellar-sheet-body">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="cellar-sheet-title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function useSubmit(save: Save, onClose: () => void) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await save("wine_set_placement", input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
// 와인 상세와 셀러 화면에서 함께 쓰는 위치 수정. 층마다 이 와인의 병 수를 정한다.
export function PlacementEditor({
  wine,
  data,
  save,
  onClose,
}: {
  wine: Wine;
  data: Snapshot;
  save: Save;
  onClose: () => void;
}) {
  const current = winePlacement(wine, data.placements);
  const others = shelfTotals(data.placements, wine.id);
  const [counts, setCounts] = useState(() => {
    const c = Array<number>(CELLAR_SHELVES + 1).fill(0);
    for (const p of current.shelves) c[p.shelf] = p.quantity;
    return c;
  });
  const { busy, error, run } = useSubmit(save, onClose);
  const placed = counts.reduce((a, b) => a + b, 0);
  const changed = counts.some(
    (n, shelf) =>
      n !== (current.shelves.find((p) => p.shelf === shelf)?.quantity ?? 0),
  );
  const set = (shelf: number, n: number) =>
    setCounts((c) => c.map((v, i) => (i === shelf ? n : v)));
  return (
    <Sheet
      eyebrow="CELLAR PLACEMENT"
      title="셀러 위치"
      onClose={onClose}
      busy={busy}
    >
      <p className="muted cellar-sheet-lead">
        {wine.name} · 보유 {wine.stock}병 · 셀러 {placed}병
        {wine.stock - placed > 0 && ` · 자리 없음 ${wine.stock - placed}병`}
      </p>
      <div className="placement-rows">
        {shelvesTopDown.map((shelf) => {
          const mine = counts[shelf],
            used = others[shelf];
          const full = used + mine >= CELLAR_SHELF_CAPACITY;
          return (
            <div
              className={`placement-row${mine ? " has-mine" : ""}`}
              key={shelf}
            >
              <span className="placement-shelf">{shelf}층</span>
              <span className="placement-cells" aria-hidden>
                {Array.from({ length: CELLAR_SHELF_CAPACITY }, (_, i) => (
                  <i
                    key={i}
                    className={
                      i < used ? "other" : i < used + mine ? "mine" : ""
                    }
                  />
                ))}
              </span>
              <span className="placement-stepper">
                <button
                  type="button"
                  aria-label={`${shelf}층에서 한 병 빼기`}
                  disabled={busy || mine === 0}
                  onClick={() => set(shelf, mine - 1)}
                >
                  <Minus size={14} />
                </button>
                <b>{mine}</b>
                <button
                  type="button"
                  aria-label={`${shelf}층에 한 병 넣기`}
                  disabled={busy || full || placed >= wine.stock}
                  onClick={() => set(shelf, mine + 1)}
                >
                  <Plus size={14} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="dialog-footer">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || !changed}
          onClick={() =>
            run(
              placementInput(
                wine,
                data,
                counts.map((quantity, shelf) => ({ shelf, quantity })),
              ),
            )
          }
        >
          {busy && <LoaderCircle className="spin" size={16} />}
          저장
        </button>
      </div>
    </Sheet>
  );
}
type Picked =
  | { kind: "bottle"; wine: Wine; shelf: number }
  | { kind: "empty"; shelf: number }
  | { kind: "edit"; wine: Wine };
export function WineCellarMap({
  data,
  save,
  href,
  demo,
  inform,
  initialWine = "",
}: {
  data: Snapshot;
  save: Save;
  href: (url: string) => string;
  demo: boolean;
  inform: (text: string) => void;
  initialWine?: string;
}) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [focus, setFocus] = useState(initialWine);
  const wines = new Map(data.wines.map((w) => [w.id, w]));
  const totals = shelfTotals(data.placements);
  const placedAll = totals.reduce((a, b) => a + b, 0);
  const capacity = CELLAR_SHELVES * CELLAR_SHELF_CAPACITY;
  const unplaced = data.wines
    .filter((w) => !w.archived && w.stock > 0)
    .map((w) => ({ wine: w, ...winePlacement(w, data.placements) }))
    .filter((r) => r.unplaced > 0)
    .sort((a, b) => a.wine.name.localeCompare(b.wine.name, "ko"));
  const unplacedBottles = unplaced.reduce((a, r) => a + r.unplaced, 0);
  const pick = (p: Picked) => {
    if (demo)
      inform("둘러보기 화면입니다. 로그인하면 위치를 저장할 수 있어요.");
    else setPicked(p);
  };
  const close = () => setPicked(null);
  const toggleFocus = (id: string) => {
    const next = focus === id ? "" : id;
    setFocus(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("wine", next);
    else url.searchParams.delete("wine");
    window.history.replaceState(null, "", url);
  };
  // 같은 층의 병은 처음 넣은 순서(placed_at)대로 왼쪽부터 채운다.
  const shelfBottles = (shelf: number) =>
    data.placements
      .filter((p) => p.shelf === shelf && wines.has(p.wine_id))
      .flatMap((p) =>
        Array.from({ length: p.quantity }, () => wines.get(p.wine_id)!),
      );
  const focused = focus ? wines.get(focus) : undefined;
  // 범례는 셀러에 실제로 있는 종류만 보여준다.
  const present = new Set(
    data.placements
      .filter((p) => wines.has(p.wine_id))
      .map((p) => kindOf(wines.get(p.wine_id)!)),
  );
  const legend = bottleKinds.filter((k) => present.has(k.key));
  return (
    <>
      <div className="cellar-map-stats">
        <div>
          <span>셀러</span>
          <strong>
            {placedAll}
            <small> / {capacity}병</small>
          </strong>
        </div>
        <div>
          <span>빈 칸</span>
          <strong>{capacity - placedAll}</strong>
        </div>
        <div>
          <span>자리 없는 병</span>
          <strong>{unplacedBottles}</strong>
        </div>
      </div>
      {focused && (
        <div className="cellar-focus">
          <span>
            <b>{focused.name}</b> 위치를 표시하고 있어요
          </span>
          <button className="text-button" onClick={() => toggleFocus("")}>
            표시 끄기
          </button>
        </div>
      )}
      <div className="cellar-layout">
        <div className="cellar-stage">
          <section className="cellar-cabinet" aria-label="와인 셀러 층별 배치">
            <div className="cellar-glass">
              {/* 실물처럼 유리 안 맨 위 가운데의 조작부. 표시창에는 셀러에 든 병 수를 띄운다. */}
              <div className="cellar-panel" aria-hidden>
                <i />
                <i />
                <span className="cellar-display">
                  {placedAll}
                  <small>/{capacity}</small>
                </span>
                <i />
                <i />
              </div>
              {shelvesTopDown.map((shelf) => {
                const bottles = shelfBottles(shelf);
                return (
                  <div className="cellar-shelf" key={shelf}>
                    <span className="cellar-shelf-no">{shelf}</span>
                    <div className="cellar-slots">
                      {Array.from({ length: CELLAR_SHELF_CAPACITY }, (_, i) => {
                        const wine = bottles[i];
                        if (!wine)
                          return (
                            <button
                              key={i}
                              className="cellar-slot empty"
                              aria-label={`${shelf}층 빈 칸에 와인 넣기`}
                              onClick={() => pick({ kind: "empty", shelf })}
                            >
                              <Plus size={12} />
                            </button>
                          );
                        const dim = focus && focus !== wine.id;
                        return (
                          <button
                            key={i}
                            className={`cellar-slot${dim ? " dim" : ""}${focus === wine.id ? " lit" : ""}`}
                            title={`${wine.name} · ${vintageLabel(wine)}`}
                            aria-label={`${shelf}층 ${wine.name}`}
                            onClick={() =>
                              pick({ kind: "bottle", wine, shelf })
                            }
                          >
                            <BottleEnd kind={kindOf(wine)} />
                          </button>
                        );
                      })}
                    </div>
                    <span className="cellar-shelf-count">
                      {totals[shelf]}/{CELLAR_SHELF_CAPACITY}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="cellar-base" aria-hidden>
              <span className="cellar-lock" />
            </div>
          </section>
          {legend.length > 0 && (
            <ul className="cellar-legend">
              {legend.map((k) => (
                <li key={k.key}>
                  <BottleEnd kind={k.key} />
                  {k.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="cellar-unplaced panel">
          <div className="section-heading compact">
            <h2>자리 없는 병</h2>
            <span className="muted small">
              {unplaced.length}종 {unplacedBottles}병
            </span>
          </div>
          {unplaced.length ? (
            unplaced.map((r) => (
              <div className="cellar-unplaced-row" key={r.wine.id}>
                <Bottle wine={r.wine} />
                <Link href={href(`/wine/${r.wine.id}`)}>
                  <strong>{r.wine.name}</strong>
                  <small>
                    {vintageLabel(r.wine)} · 보유 {r.wine.stock}병
                    {r.placed > 0 && ` · 셀러 ${r.placed}병`}
                  </small>
                </Link>
                <span className="cellar-unplaced-count">{r.unplaced}병</span>
                <button
                  className="button secondary small-button"
                  onClick={() => pick({ kind: "edit", wine: r.wine })}
                >
                  넣기
                </button>
              </div>
            ))
          ) : (
            <p className="muted small">
              보유한 병이 모두 셀러에 들어 있어요. 새로 산 와인은 입고한 뒤
              여기서 넣습니다.
            </p>
          )}
        </aside>
      </div>
      {picked?.kind === "edit" && (
        <PlacementEditor
          wine={picked.wine}
          data={data}
          save={save}
          onClose={close}
        />
      )}
      {picked?.kind === "bottle" && (
        <BottleSheet
          wine={picked.wine}
          shelf={picked.shelf}
          data={data}
          save={save}
          href={href}
          onClose={close}
          onEdit={() => setPicked({ kind: "edit", wine: picked.wine })}
          onFocus={() => {
            toggleFocus(picked.wine.id);
            close();
          }}
        />
      )}
      {picked?.kind === "empty" && (
        <EmptySlotSheet
          shelf={picked.shelf}
          free={CELLAR_SHELF_CAPACITY - totals[picked.shelf]}
          candidates={unplaced.map((r) => r.wine)}
          data={data}
          save={save}
          onClose={close}
        />
      )}
    </>
  );
}
function BottleSheet({
  wine,
  shelf,
  data,
  save,
  href,
  onClose,
  onEdit,
  onFocus,
}: {
  wine: Wine;
  shelf: number;
  data: Snapshot;
  save: Save;
  href: (url: string) => string;
  onClose: () => void;
  onEdit: () => void;
  onFocus: () => void;
}) {
  const { shelves } = winePlacement(wine, data.placements);
  const here = shelves.find((p) => p.shelf === shelf)?.quantity ?? 0;
  const totals = shelfTotals(data.placements);
  const { busy, error, run } = useSubmit(save, onClose);
  const moveTo = (target: number | null) =>
    run(
      placementInput(wine, data, [
        ...shelves.filter((p) => p.shelf !== shelf && p.shelf !== target),
        { shelf, quantity: here - 1 },
        ...(target
          ? [
              {
                shelf: target,
                quantity:
                  (shelves.find((p) => p.shelf === target)?.quantity ?? 0) + 1,
              },
            ]
          : []),
      ]),
    );
  return (
    <Sheet
      eyebrow={`SHELF ${shelf}`}
      title={wine.name}
      onClose={onClose}
      busy={busy}
    >
      <div className="cellar-bottle-info">
        <Bottle wine={wine} />
        <div>
          <p>
            {wine.type} · {vintageLabel(wine)}
            {wine.country && ` · ${wine.country}`}
          </p>
          <p className="muted small">
            {shelf}층에 {here}병 · 보유 {wine.stock}병
          </p>
          <div className="text-actions">
            <Link href={href(`/wine/${wine.id}`)}>
              상세 보기 <ExternalLink size={13} />
            </Link>
            <button onClick={onFocus}>이 와인 모두 표시</button>
            <button onClick={onEdit}>
              <Pencil size={13} />
              위치 수정
            </button>
          </div>
        </div>
      </div>
      <h3 className="cellar-sheet-sub">한 병 다른 층으로 옮기기</h3>
      <div className="cellar-shelf-chips">
        {shelvesTopDown
          .filter((s) => s !== shelf)
          .map((s) => {
            const free = CELLAR_SHELF_CAPACITY - totals[s];
            return (
              <button
                key={s}
                disabled={busy || free <= 0}
                onClick={() => moveTo(s)}
              >
                {s}층<small>{free > 0 ? `${free}칸` : "가득"}</small>
              </button>
            );
          })}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="dialog-footer">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => moveTo(null)}
        >
          {busy && <LoaderCircle className="spin" size={16} />}
          셀러에서 한 병 빼기
        </button>
      </div>
      <p className="muted small cellar-sheet-note">
        뺀 병은 재고에 그대로 남고 &quot;자리 없는 병&quot;이 됩니다. 마신 병은
        상세에서 소비로 기록하세요.
      </p>
    </Sheet>
  );
}
function EmptySlotSheet({
  shelf,
  free,
  candidates,
  data,
  save,
  onClose,
}: {
  shelf: number;
  free: number;
  candidates: Wine[];
  data: Snapshot;
  save: Save;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const { busy, error, run } = useSubmit(save, onClose);
  const rows = candidates.filter(
    (w) =>
      !q ||
      `${w.name} ${w.english_name} ${w.producer}`
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  );
  const put = (wine: Wine) => {
    const { shelves } = winePlacement(wine, data.placements);
    const here = shelves.find((p) => p.shelf === shelf)?.quantity ?? 0;
    run(
      placementInput(wine, data, [
        ...shelves.filter((p) => p.shelf !== shelf),
        { shelf, quantity: here + 1 },
      ]),
    );
  };
  return (
    <Sheet
      eyebrow={`SHELF ${shelf}`}
      title={`${shelf}층에 넣기`}
      onClose={onClose}
      busy={busy}
    >
      <p className="muted cellar-sheet-lead">
        {free}칸 남음 · 자리 없는 병이 있는 와인에서 한 병을 넣습니다.
      </p>
      {candidates.length > 6 && (
        <label className="field cellar-sheet-search">
          <input
            aria-label="와인 검색"
            placeholder="이름·생산자 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      )}
      <div className="cellar-candidates">
        {rows.map((w) => (
          <button
            key={w.id}
            disabled={busy}
            onClick={() => put(w)}
            className="cellar-candidate"
          >
            <Bottle wine={w} />
            <span>
              <strong>{w.name}</strong>
              <small>
                {vintageLabel(w)} · 자리 없음{" "}
                {winePlacement(w, data.placements).unplaced}병
              </small>
            </span>
            <Plus size={16} />
          </button>
        ))}
        {!candidates.length && (
          <p className="muted small">
            셀러에 넣을 병이 없습니다. 보유한 병이 모두 셀러에 있어요.
          </p>
        )}
        {candidates.length > 0 && !rows.length && (
          <p className="muted small">검색 결과가 없습니다.</p>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}
    </Sheet>
  );
}
