"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  FRIDGE_MAX_ADD,
  fridgeDayLabel,
  fridgeIcon,
  fridgePlaceLabels,
  fridgeStaples,
  findFridgeItem,
  matchMeals,
  splitFridgeNames,
  type FridgeItem,
  type FridgePlace,
  type FridgeState,
} from "@/lib/fridge";
import type { MealDish } from "@/lib/meals";
import { demoMeals } from "@/lib/demo-meals";
import { demoFridge } from "@/lib/demo-fridge";
import { today } from "@/lib/format";
import type { Operation } from "@/lib/contracts";

// 취미 > 냉장고. 냉장·냉동 두 칸에 재료를 두고 넣은 날만 보여준다(개수·양·유통기한 없음).
// 꾹 눌러 끌어서 "다 먹었어요/버렸어요"에 놓으면 빠지고, 반대 칸에 놓으면 옮겨진다.
// 오른쪽은 집밥 요리의 메인 재료로 맞춘 "이걸로 해먹기". 목록은 /api/fridge·/api/meals,
// 저장은 공통 /api/commands(fridge_*)다. 데모는 화면에서만 바뀌고 저장하지 않는다.
type Drop = "eat" | "waste" | FridgePlace;
type Undo = { text: string; undo?: () => Promise<void> | void };
const LONG_PRESS_MS = 380;
const REFRESH_MS = 120000;

async function command(operation: Operation, input: Record<string, unknown>) {
  const r = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation,
      input: { idempotency_key: crypto.randomUUID(), ...input },
    }),
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
  return body.data as Record<string, unknown>;
}

function AddSheet({
  place: initialPlace,
  recent,
  suggestions,
  busy,
  onClose,
  onAdd,
}: {
  place: FridgePlace;
  recent: string[];
  suggestions: string[];
  busy: boolean;
  onClose: () => void;
  onAdd: (place: FridgePlace, names: string[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [place, setPlace] = useState(initialPlace);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const names = splitFridgeNames([...picked, text].join("\n")).slice(
    0,
    FRIDGE_MAX_ADD,
  );
  const toggle = (n: string) =>
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const chips = (list: string[]) => (
    <div className="fr-chips">
      {list.map((n) => (
        <button
          type="button"
          key={n}
          className={picked.includes(n) ? "on" : ""}
          onClick={() => toggle(n)}
        >
          <span aria-hidden>{fridgeIcon(n)}</span>
          {n}
        </button>
      ))}
    </div>
  );
  return (
    <dialog
      ref={ref}
      className="record-dialog fr-sheet"
      aria-labelledby="fr-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        className="fr-sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (names.length) onAdd(place, names);
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MONO / FRIDGE</span>
            <h2 id="fr-sheet-title">무엇을 넣나요?</h2>
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
        <div className="fr-where" role="radiogroup" aria-label="넣을 칸">
          {(["cold", "frozen"] as const).map((p) => (
            <button
              type="button"
              key={p}
              role="radio"
              aria-checked={place === p}
              className={`${p} ${place === p ? "on" : ""}`}
              onClick={() => setPlace(p)}
            >
              {p === "cold" ? "🥬" : "❄︎"} {fridgePlaceLabels[p]}
            </button>
          ))}
        </div>
        <input
          className="fr-input"
          value={text}
          placeholder="쉼표로 여러 개: 두부, 대파, 삼겹살"
          aria-label="넣을 재료"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        {recent.length > 0 && (
          <>
            <p className="fr-chip-title">최근에 다 먹은 것 · 다시 넣기</p>
            {chips(recent)}
          </>
        )}
        {suggestions.length > 0 && (
          <>
            <p className="fr-chip-title">집밥에 나오는 재료</p>
            {chips(suggestions)}
          </>
        )}
        <div className="fr-sheet-foot">
          <span>
            {names.length
              ? `${fridgePlaceLabels[place]}에 ${names.join(", ")} · 오늘 날짜로`
              : "이름만 적으면 오늘 날짜로 들어가요"}
          </span>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button className="button primary" disabled={busy || !names.length}>
            넣기
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function FridgeBoard({
  demo = false,
  href,
}: {
  demo?: boolean;
  href: (url: string) => string;
}) {
  const [state, setState] = useState<FridgeState | null>(
    demo ? demoFridge() : null,
  );
  const [dishes, setDishes] = useState<MealDish[]>(demo ? demoMeals : []);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState<FridgePlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [toast, setToast] = useState<Undo | null>(null);
  const [dragging, setDragging] = useState<FridgeItem | null>(null);
  const [over, setOver] = useState<Drop | null>(null);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    item: FridgeItem;
    over: Drop | null;
    x: number;
    y: number;
  } | null>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const day = today();

  // 다른 기기(폰)에서 바꾼 것도 보이도록 화면에 돌아올 때와 2분마다 다시 읽는다.
  useEffect(() => {
    if (demo) return;
    let live = true;
    Promise.all([
      fetch("/api/fridge", { cache: "no-store" }),
      fetch("/api/meals", { cache: "no-store" }),
    ])
      .then(async ([f, m]) => {
        const [fb, mb] = await Promise.all([f.json(), m.json()]);
        if (!f.ok) throw Error(fb.error?.message ?? "불러오지 못했습니다.");
        if (!live) return;
        setState(fb as FridgeState);
        if (m.ok) setDishes(mb.dishes as MealDish[]);
        setError("");
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [demo, revision]);
  useEffect(() => {
    if (demo) return;
    const reload = () => {
      if (document.visibilityState === "visible" && !dragRef.current)
        setRevision((r) => r + 1);
    };
    const timer = window.setInterval(reload, REFRESH_MS);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [demo]);

  const inform = (t: Undo) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  };
  const fail = (e: unknown) => {
    inform({ text: (e as Error).message });
    setRevision((r) => r + 1);
  };
  const patch = (fn: (s: FridgeState) => FridgeState) =>
    setState((s) => (s ? fn(s) : s));
  const replaceItem = (item: FridgeItem) =>
    patch((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === item.id ? item : i)),
    }));

  // 화면을 먼저 바꾸고 저장한다. 실패하면 서버 목록으로 다시 맞춘다.
  async function drop(item: FridgeItem, target: Drop) {
    const before = state;
    if (target === "eat" || target === "waste") {
      patch((s) => ({
        items: s.items.filter((i) => i.id !== item.id),
        recent:
          target === "eat"
            ? [item.name, ...s.recent.filter((n) => n !== item.name)]
            : s.recent,
        wasted_this_month: s.wasted_this_month + (target === "waste" ? 1 : 0),
      }));
      const text =
        target === "eat" ? `${item.name} 다 먹었어요` : `${item.name} 버렸어요`;
      if (demo) return inform({ text, undo: () => setState(before) });
      try {
        const saved = (await command("fridge_remove", {
          id: item.id,
          expected_version: item.version,
          reason: target === "eat" ? "eaten" : "wasted",
        })) as FridgeItem;
        inform({
          text,
          undo: async () => {
            const back = (await command("fridge_restore", {
              id: saved.id,
              expected_version: saved.version,
            })) as FridgeItem;
            patch((s) => ({ ...s, items: [...s.items, back] }));
            // 최근 다 먹은 것·버린 수는 서버 기준으로 다시 맞춘다.
            setRevision((r) => r + 1);
          },
        });
      } catch (e) {
        fail(e);
      }
      return;
    }
    const from = item.place;
    replaceItem({ ...item, place: target });
    setFreshIds([item.id]);
    const text = `${item.name} ${fridgePlaceLabels[target]}로 옮겼어요`;
    if (demo) return inform({ text, undo: () => setState(before) });
    try {
      const saved = (await command("fridge_move", {
        id: item.id,
        expected_version: item.version,
        place: target,
      })) as FridgeItem;
      replaceItem(saved);
      inform({
        text,
        undo: async () => {
          replaceItem(
            (await command("fridge_move", {
              id: saved.id,
              expected_version: saved.version,
              place: from,
            })) as FridgeItem,
          );
        },
      });
    } catch (e) {
      fail(e);
    }
  }

  async function add(place: FridgePlace, names: string[]) {
    const text = `${fridgePlaceLabels[place]}에 ${names.join(", ")} 넣었어요`;
    if (demo) {
      const before = state;
      const items = names.map((name, i) => ({
        id: `demo-${Date.now()}-${i}`,
        name,
        place,
        added_on: day,
        version: 1,
      }));
      patch((s) => ({
        ...s,
        items: [...s.items, ...items],
        recent: s.recent.filter((n) => !names.includes(n)),
      }));
      setFreshIds(items.map((i) => i.id));
      setAdding(null);
      return inform({ text, undo: () => setState(before) });
    }
    setBusy(true);
    try {
      const { items } = (await command("fridge_add", { place, names })) as {
        items: FridgeItem[];
      };
      patch((s) => ({
        ...s,
        items: [...s.items, ...items],
        recent: s.recent.filter((n) => !names.includes(n)),
      }));
      setFreshIds(items.map((i) => i.id));
      setAdding(null);
      inform({
        text,
        undo: async () => {
          await command("fridge_delete", {
            items: items.map((i) => ({
              id: i.id,
              expected_version: i.version,
            })),
          });
          const ids = new Set(items.map((i) => i.id));
          patch((s) => ({
            ...s,
            items: s.items.filter((i) => !ids.has(i.id)),
          }));
          setRevision((r) => r + 1);
        },
      });
    } catch (e) {
      inform({ text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // 꾹 누르기 → 끌기. 끄는 동안 화면 스크롤을 막고, 손가락 아래의 data-drop으로 놓을 곳을 정한다.
  const dropRef = useRef(drop);
  useEffect(() => {
    dropRef.current = drop;
  });
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const move = (x: number, y: number) => {
      const g = ghostRef.current;
      if (g) {
        g.style.left = `${x}px`;
        g.style.top = `${y}px`;
      }
      const el = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-drop]");
      let target = (el?.dataset.drop as Drop | undefined) ?? null;
      if (target === dragging.place) target = null;
      if (dragRef.current && dragRef.current.over !== target) {
        dragRef.current.over = target;
        setOver(target);
      }
    };
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const finish = (e: PointerEvent) => {
      const target = e.type === "pointerup" ? dragRef.current?.over : null;
      dragRef.current = null;
      setDragging(null);
      setOver(null);
      if (target) void dropRef.current(dragging, target);
    };
    if (dragRef.current) move(dragRef.current.x, dragRef.current.y);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
    };
  }, [dragging]);
  // 누르고 있는 동안 화면이 다시 그려져도 같은 타이머를 쓰도록 ref에 둔다.
  const cancelPress = () => {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };
  const pressHandlers = (item: FridgeItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button > 0 || dragRef.current) return;
      cancelPress();
      const x = e.clientX;
      const y = e.clientY;
      pressRef.current = {
        x,
        y,
        timer: window.setTimeout(() => {
          pressRef.current = null;
          dragRef.current = { item, over: null, x, y };
          setSelectedMeal(null);
          setDragging(item);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = pressRef.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const items = state?.items ?? [];
  const matches = matchMeals(dishes, items);
  const ready = matches.filter((m) => m.missing === 0);
  const almost = matches.filter((m) => m.missing === 1);
  const selected = matches.find((m) => m.dish.id === selectedMeal);
  const hitIds = new Set(
    selected?.parts.flatMap((p) => (p.item ? [p.item.id] : [])) ?? [],
  );
  const suggestions = [...new Set(dishes.flatMap((d) => d.ingredients))].filter(
    (n) =>
      !findFridgeItem(items, n) &&
      !fridgeStaples.includes(n) &&
      !(state?.recent ?? []).includes(n),
  );

  const box = (place: FridgePlace) => {
    // 오래 둔 것부터. 서버도 같은 순서로 주지만 화면에서 넣은 것은 뒤에 붙으므로 다시 맞춘다.
    const list = items
      .filter((i) => i.place === place)
      .sort((a, b) => a.added_on.localeCompare(b.added_on));
    const canMove = dragging && dragging.place !== place;
    return (
      <section
        className={`fr-box ${place}`}
        data-drop={place}
        aria-label={fridgePlaceLabels[place]}
      >
        <div className="fr-box-head">
          <b>{fridgePlaceLabels[place]}</b>
          <span>{state ? `${list.length}가지` : ""}</span>
          <em>오래 둔 것부터</em>
          <button
            className="fr-plus"
            aria-label={`${fridgePlaceLabels[place]}에 넣기`}
            onClick={() => setAdding(place)}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className={`fr-tiles ${selected ? "focus" : ""}`}>
          {list.map((i) => (
            <button
              key={i.id}
              className={[
                "fr-tile",
                hitIds.has(i.id) ? "hit" : "",
                dragging?.id === i.id ? "lifted" : "",
                freshIds.includes(i.id) ? "fresh" : "",
              ].join(" ")}
              aria-label={`${i.name}, ${fridgeDayLabel(i.added_on, day)} 넣음. 꾹 눌러 끌면 빼거나 옮깁니다`}
              {...pressHandlers(i)}
              onClick={() => {
                if (!dragRef.current)
                  inform({
                    text: "꾹 누른 채로 끌어서 아래에 놓으면 빠져요",
                  });
              }}
            >
              <span className="fr-icon" aria-hidden>
                {fridgeIcon(i.name)}
              </span>
              <span className="fr-name">{i.name}</span>
              <span className="fr-day">{fridgeDayLabel(i.added_on, day)}</span>
            </button>
          ))}
          {state && !list.length && (
            <p className="fr-empty">
              비어 있어요. ＋를 눌러 {fridgePlaceLabels[place]}에 넣어 보세요.
            </p>
          )}
        </div>
        {canMove && (
          <div className={`fr-move ${over === place ? "over" : ""}`}>
            <span aria-hidden>{place === "frozen" ? "❄︎" : "🥬"}</span>
            {fridgePlaceLabels[place]}로 옮기기
          </div>
        )}
      </section>
    );
  };

  const mealCard = (m: (typeof matches)[number]) => (
    <button
      key={m.dish.id}
      className={`fr-meal ${selectedMeal === m.dish.id ? "on" : ""}`}
      aria-pressed={selectedMeal === m.dish.id}
      onClick={() =>
        setSelectedMeal((s) => (s === m.dish.id ? null : m.dish.id))
      }
    >
      <span className="fr-meal-title">
        {m.dish.title}
        <small>{m.dish.category}</small>
      </span>
      <span className="fr-meal-ing">
        {m.parts.map((p) => (
          <span key={p.name} className={p.state}>
            {p.state === "frozen" && "❄︎ "}
            {p.name}
            {p.state === "missing" && " 없음"}
          </span>
        ))}
      </span>
    </button>
  );

  return (
    <div className={`fr-page ${dragging ? "dragging" : ""}`}>
      <div className="fr-heading">
        <div>
          <span className="eyebrow">MONO / HOBBY / FRIDGE</span>
          <h1>
            냉장고<span className="heading-dot">.</span>
          </h1>
        </div>
        <p>
          꾹 누른 채로 끌어서 빼기 · 반대 칸에 놓으면 옮기기
          {state && state.wasted_this_month > 0 && (
            <span className="fr-waste">
              이번 달 버린 것 {state.wasted_this_month}개
            </span>
          )}
        </p>
        <button className="button primary" onClick={() => setAdding("cold")}>
          <Plus size={16} /> 넣기
        </button>
      </div>
      {error && <p className="fr-error">{error}</p>}

      <div className="fr-board">
        {box("cold")}
        {box("frozen")}
        <aside className="fr-side">
          <h2>🍳 이걸로 해먹기</h2>
          <p>
            <a href={href("/hobby/meals")}>집밥</a> 요리의 메인 재료로 찾았어요.
            누르면 냉장고에서 재료를 짚어 줘요.
          </p>
          <div className="fr-meals">
            {ready.length > 0 && (
              <>
                <h3>지금 바로 · {ready.length}</h3>
                {ready.map(mealCard)}
              </>
            )}
            {almost.length > 0 && (
              <>
                <h3>하나만 있으면 · {almost.length}</h3>
                {almost.map(mealCard)}
              </>
            )}
            {state && !matches.length && (
              <p className="fr-empty">
                {dishes.length
                  ? "지금 재료로 맞는 집밥이 없어요."
                  : "집밥에 요리를 추가하면 여기서 골라 드려요."}
              </p>
            )}
          </div>
          <p className="fr-staples">
            <b>늘 있는 재료</b> {fridgeStaples.join(" · ")}
          </p>
        </aside>
      </div>

      {dragging && (
        <>
          <div className="fr-drops">
            <div
              className={`fr-drop eat ${over === "eat" ? "over" : ""}`}
              data-drop="eat"
            >
              <span aria-hidden>🍽️</span>다 먹었어요
              <small>목록에서 빠져요</small>
            </div>
            <div
              className={`fr-drop waste ${over === "waste" ? "over" : ""}`}
              data-drop="waste"
            >
              <span aria-hidden>🗑️</span>
              버렸어요
              <small>버린 기록에 남아요</small>
            </div>
          </div>
          <div
            ref={ghostRef}
            className={`fr-ghost ${over ? "over" : ""}`}
            aria-hidden
          >
            <span>{fridgeIcon(dragging.name)}</span>
            {dragging.name}
          </div>
        </>
      )}

      {adding && (
        <AddSheet
          place={adding}
          recent={state?.recent ?? []}
          suggestions={suggestions}
          busy={busy}
          onClose={() => setAdding(null)}
          onAdd={add}
        />
      )}
      {/* 끄는 동안에는 알림이 아래 놓을 곳을 가리지 않게 숨긴다. */}
      {toast && !dragging && (
        <div className="toast fr-toast" role="status">
          {toast.text}
          {toast.undo && (
            <button
              onClick={async () => {
                const u = toast.undo;
                setToast(null);
                try {
                  await u?.();
                } catch (e) {
                  fail(e);
                }
              }}
            >
              되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
