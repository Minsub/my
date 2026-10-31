"use client";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  MEAL_MAX_LINKS,
  filterMeals,
  linkHost,
  mealCategories,
  mealWordCounts,
  splitMealWords,
  youtubeId,
  type LinkPreview,
  type MealDish,
} from "@/lib/meals";
import { demoMeals } from "@/lib/demo-meals";
import { dateLabel } from "@/lib/format";
import type { Operation } from "@/lib/contracts";

// 취미 > 집밥. 집에서 해먹을 요리 목록. 검색어·카테고리·태그·해보고 싶음은 URL(q, category, tag, want)에 남긴다.
// 목록은 /api/meals, 저장은 공통 /api/commands(meal_*)를 쓴다. 링크 썸네일은 저장하지 않고 볼 때 읽는다.

const previews = new Map<string, Promise<LinkPreview | null>>();
function loadPreview(url: string) {
  let p = previews.get(url);
  if (!p) {
    p = fetch(`/api/meals/preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<LinkPreview>) : null))
      .catch(() => null);
    previews.set(url, p);
  }
  return p;
}
// 화면에 보일 때만 미리보기를 읽는다. YouTube 썸네일은 영상 ID로 바로 만든다.
function usePreview(url: string | undefined, demo: boolean, needTitle = false) {
  // 콜백 ref로 받은 요소. 요소가 붙으면 관찰을 시작한다.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<LinkPreview | null>(null);
  const video = url ? youtubeId(url) : null;
  const skip = !url || demo || (Boolean(video) && !needTitle);
  useEffect(() => {
    const el = node;
    if (skip || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [skip, node]);
  useEffect(() => {
    if (skip || !visible || !url) return;
    let live = true;
    loadPreview(url).then((v) => {
      if (live) setData(v);
    });
    return () => {
      live = false;
    };
  }, [skip, visible, url]);
  const image =
    data?.image ??
    (video ? `https://i.ytimg.com/vi/${video}/hqdefault.jpg` : null);
  return {
    setNode,
    image,
    title: data?.title ?? null,
    site: data?.site ?? null,
  };
}
function Thumb({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 링크의 og 이미지를 프록시 없이 그대로 보인다.
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
function CardThumb({ url, demo }: { url: string; demo: boolean }) {
  const { setNode, image } = usePreview(url, demo);
  return (
    <span className="ml-card-thumb" ref={setNode}>
      <Link2 size={18} aria-hidden />
      {image && <Thumb className="ml-thumb-img" src={image} />}
    </span>
  );
}
function LinkCard({ url, demo }: { url: string; demo: boolean }) {
  const { setNode, image, title, site } = usePreview(url, demo, true);
  return (
    <a
      className="ml-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      ref={setNode}
    >
      <span className="ml-link-thumb">
        <Link2 size={18} aria-hidden />
        {image && <Thumb className="ml-thumb-img" src={image} />}
      </span>
      <span className="ml-link-text">
        <strong>{title ?? linkHost(url)}</strong>
        <small>{title ? (site ?? linkHost(url)) : url}</small>
      </span>
      <ExternalLink size={15} aria-hidden />
    </a>
  );
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
      className="record-dialog ml-sheet"
      aria-labelledby="ml-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="ml-sheet-body">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="ml-sheet-title">{title}</h2>
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

async function command(operation: Operation, input: Record<string, unknown>) {
  const r = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
  return body;
}

// 쉼표로 적는 입력 + 이미 쓴 이름 제안. 마지막 쉼표 뒤 글자로 제안을 좁히고, 누르면 그 자리를 채운다.
function WordsField({
  label,
  value,
  onChange,
  placeholder,
  known,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  known: string[];
  required?: boolean;
}) {
  const parts = value.split(/[,，]/);
  const partial = parts[parts.length - 1].trim();
  const used = splitMealWords(value);
  const suggestions = known
    .filter((w) => !used.includes(w) && (!partial || w.includes(partial)))
    .slice(0, 10);
  const pick = (w: string) => {
    const head = parts
      .slice(0, -1)
      .map((p) => p.trim())
      .filter(Boolean);
    onChange([...head, w].join(", ") + ", ");
  };
  return (
    <label className="field field-wide">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <span className="ml-suggest">
          {suggestions.map((w) => (
            <button type="button" key={w} onClick={() => pick(w)}>
              {w}
            </button>
          ))}
        </span>
      )}
    </label>
  );
}

function MealForm({
  dish,
  dishes,
  onClose,
  onSaved,
}: {
  dish: MealDish | null;
  dishes: MealDish[];
  onClose: () => void;
  onSaved: (dish: MealDish, created: boolean) => void;
}) {
  const [title, setTitle] = useState(dish?.title ?? "");
  const [category, setCategory] = useState(dish?.category ?? "한식");
  const [ingredients, setIngredients] = useState(
    dish ? dish.ingredients.join(", ") : "",
  );
  const [tags, setTags] = useState(dish ? dish.tags.join(", ") : "");
  const [links, setLinks] = useState<string[]>(
    dish?.links.length ? dish.links : [""],
  );
  const [memo, setMemo] = useState(dish?.memo ?? "");
  const [want, setWant] = useState(dish?.want_to_try ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 실패한 저장은 서버에서 되돌려지므로 폼을 연 동안 같은 키를 다시 써도 된다.
  const [key] = useState(() => crypto.randomUUID());
  const knownIngredients = mealWordCounts(dishes, "ingredients").map(
    (w) => w.name,
  );
  const knownTags = mealWordCounts(dishes, "tags").map((w) => w.name);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const words = splitMealWords(ingredients);
    if (!words.length) {
      setError("메인 재료를 하나 이상 적어주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const input = {
        idempotency_key: key,
        title: title.trim(),
        category,
        ingredients: words,
        tags: splitMealWords(tags),
        links: links.map((l) => l.trim()).filter(Boolean),
        memo: memo.trim(),
        want_to_try: want,
        ...(dish ? { id: dish.id, expected_version: dish.version } : {}),
      };
      const saved = (await command(
        dish ? "meal_update" : "meal_create",
        input,
      )) as MealDish;
      onSaved(saved, !dish);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={dish ? "요리 고치기" : "요리 추가"}
      eyebrow="HOBBY / MEALS"
      onClose={onClose}
      busy={busy}
    >
      <form className="ml-form" onSubmit={submit}>
        <div className="form-fields">
          <label className="field field-wide">
            <span>
              요리 이름<em> *</em>
            </span>
            <input
              value={title}
              maxLength={100}
              required
              placeholder="참치김치찌개"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <WordsField
            label="메인 재료 (쉼표로 구분)"
            value={ingredients}
            onChange={setIngredients}
            placeholder="두부, 김치, 참치"
            known={knownIngredients}
            required
          />
          <div className="field field-wide">
            <span>
              카테고리<em> *</em>
            </span>
            <div className="ml-chips" role="radiogroup" aria-label="카테고리">
              {mealCategories.map((c) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <WordsField
            label="태그 (쉼표로 구분)"
            value={tags}
            onChange={setTags}
            placeholder="매움, 국물"
            known={knownTags}
          />
          <label className="ml-want field-wide">
            <input
              type="checkbox"
              checked={want}
              onChange={(e) => setWant(e.target.checked)}
            />
            <Sparkles size={16} aria-hidden />
            <span>
              <strong>해보고 싶음</strong>
              <small>아직 안 해봤지만 해보고 싶은 요리</small>
            </span>
          </label>
          <div className="field field-wide">
            <span>링크 (YouTube·블로그 등)</span>
            <div className="ml-link-inputs">
              {links.map((l, i) => (
                <div className="ml-link-row" key={i}>
                  <input
                    type="url"
                    inputMode="url"
                    value={l}
                    placeholder="https://"
                    aria-label={`링크 ${i + 1}`}
                    onChange={(e) =>
                      setLinks(
                        links.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`링크 ${i + 1} 지우기`}
                    onClick={() =>
                      setLinks(
                        links.length > 1
                          ? links.filter((_, j) => j !== i)
                          : [""],
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {links.length < MEAL_MAX_LINKS && (
                <button
                  type="button"
                  className="text-button ml-add-link"
                  onClick={() => setLinks([...links, ""])}
                >
                  <Plus size={14} /> 링크 추가
                </button>
              )}
            </div>
          </div>
          <label className="field field-wide">
            <span>메모</span>
            <textarea
              rows={3}
              value={memo}
              maxLength={2000}
              placeholder="참치는 기름 빼고, 김치는 충분히 볶기"
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="error-box">{error}</p>}
        <div className="dialog-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function MealDetail({
  dish,
  demo,
  canEdit,
  onClose,
  onEdit,
  onDeleted,
}: {
  dish: MealDish;
  demo: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await command("meal_delete", {
        id: dish.id,
        expected_version: dish.version,
        idempotency_key: crypto.randomUUID(),
      });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={dish.title}
      eyebrow={dish.category}
      onClose={onClose}
      busy={busy}
    >
      <div className="ml-detail">
        {dish.want_to_try && (
          <span className="ml-want-badge">
            <Sparkles size={13} aria-hidden /> 해보고 싶음
          </span>
        )}
        <section>
          <h3>메인 재료</h3>
          <div className="ml-words">
            {dish.ingredients.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </section>
        {dish.tags.length > 0 && (
          <section>
            <h3>태그</h3>
            <p className="ml-tags">
              {dish.tags.map((t) => `#${t}`).join("  ")}
            </p>
          </section>
        )}
        {dish.links.length > 0 && (
          <section>
            <h3>링크 {dish.links.length}</h3>
            <div className="ml-links">
              {dish.links.map((l) => (
                <LinkCard key={l} url={l} demo={demo} />
              ))}
            </div>
          </section>
        )}
        {dish.memo && (
          <section>
            <h3>메모</h3>
            <p className="ml-memo">{dish.memo}</p>
          </section>
        )}
        <p className="ml-meta">
          {dish.created_by_name ?? "구성원"} · {dateLabel(dish.created_at)} 추가
        </p>
        {error && <p className="error-box">{error}</p>}
        {canEdit && !demo && (
          <div className="dialog-footer ml-detail-actions">
            {confirm ? (
              <>
                <span className="ml-confirm">지우면 되돌릴 수 없어요.</span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button ml-danger"
                  disabled={busy}
                  onClick={remove}
                >
                  {busy ? "지우는 중…" : "지우기"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 size={15} /> 삭제
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={onEdit}
                >
                  <Pencil size={15} /> 고치기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function MealList({
  initialQuery = {},
  demo = false,
  userId,
  isOwner,
}: {
  initialQuery?: Record<string, string>;
  demo?: boolean;
  userId: string;
  isOwner: boolean;
}) {
  const [dishes, setDishes] = useState<MealDish[] | null>(
    demo ? demoMeals : null,
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(initialQuery.q ?? "");
  const [category, setCategory] = useState(initialQuery.category ?? "");
  const [tags, setTags] = useState<string[]>(
    (initialQuery.tag ?? "").split(",").filter(Boolean),
  );
  const [want, setWant] = useState(initialQuery.want === "1");
  const [allTags, setAllTags] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealDish | "new" | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (demo) return;
    let live = true;
    fetch("/api/meals", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
        if (live) {
          setDishes(body.dishes as MealDish[]);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [demo, revision]);
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 4000);
  };
  const updateUrl = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  const list = dishes ?? [];
  const shown = filterMeals(list, { q: query, category, tags, want });
  const categories = mealCategories
    .map((c) => ({
      name: c,
      count: list.filter((d) => d.category === c).length,
    }))
    .filter((c) => c.count > 0);
  const tagCounts = mealWordCounts(list, "tags");
  const TAG_LIMIT = 12;
  const visibleTags =
    allTags || tagCounts.length <= TAG_LIMIT
      ? tagCounts
      : tagCounts.filter((t, i) => i < TAG_LIMIT || tags.includes(t.name));
  const wantCount = list.filter((d) => d.want_to_try).length;
  const opened = openId ? list.find((d) => d.id === openId) : undefined;
  const canEdit = (d: MealDish) => isOwner || d.created_by === userId;
  const toggleTag = (t: string) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setTags(next);
    updateUrl("tag", next.join(","));
  };
  const openNew = () => {
    if (demo)
      inform("둘러보기 화면입니다. 로그인하면 요리를 추가할 수 있어요.");
    else setEditing("new");
  };

  return (
    <div className="ml-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONO / HOBBY / MEALS</span>
          <h1>
            집밥<span className="heading-dot">.</span>
          </h1>
          <p>
            집에서 해먹을 요리를 모아두고, 뭐 해먹을지 고를 때 봅니다.
            {dishes && ` 요리 ${list.length}개 · 해보고 싶음 ${wantCount}개`}
          </p>
        </div>
        <button className="button primary" onClick={openNew}>
          <Plus size={16} /> 요리 추가
        </button>
      </div>

      <div className="ml-filter">
        <label className="ml-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder="이름·재료·태그·메모 검색 (예: 두부)"
            aria-label="요리 검색"
            onChange={(e) => {
              setQuery(e.target.value);
              updateUrl("q", e.target.value.trim());
            }}
          />
        </label>
        <button
          type="button"
          className="ml-want-toggle"
          aria-pressed={want}
          onClick={() => {
            setWant(!want);
            updateUrl("want", want ? "" : "1");
          }}
        >
          <Sparkles size={14} aria-hidden /> 해보고 싶음{" "}
          <small>{wantCount}</small>
        </button>
      </div>
      <div className="ml-chips" role="group" aria-label="카테고리">
        {[{ name: "", count: list.length }, ...categories].map((c) => (
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
        ))}
      </div>
      {tagCounts.length > 0 && (
        <div className="ml-chips ml-tag-chips" role="group" aria-label="태그">
          {visibleTags.map((t) => (
            <button
              type="button"
              key={t.name}
              aria-pressed={tags.includes(t.name)}
              onClick={() => toggleTag(t.name)}
            >
              #{t.name}
            </button>
          ))}
          {tagCounts.length > TAG_LIMIT && (
            <button
              type="button"
              className="ml-more"
              onClick={() => setAllTags(!allTags)}
            >
              {allTags ? "접기" : `태그 ${tagCounts.length - TAG_LIMIT}개 더`}
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="error-box">{error}</p>
      ) : !dishes ? (
        <p className="ml-empty">불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="ml-empty">
          <strong>아직 요리가 없어요.</strong>
          <p>
            “요리 추가”로 넣거나, 연결한 AI에게 “참치김치찌개 집밥에 추가해줘.
            재료는 두부, 김치, 참치”처럼 말해도 돼요.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="ml-empty">
          조건에 맞는 요리가 없어요. 검색어나 필터를 바꿔 보세요.
        </p>
      ) : (
        <section className="ml-list" aria-label="요리 목록">
          {shown.map((d) => (
            <button
              type="button"
              className="ml-card"
              key={d.id}
              onClick={() => setOpenId(d.id)}
            >
              <span className="ml-card-text">
                <span className="ml-card-top">
                  <strong>{d.title}</strong>
                  {d.want_to_try && (
                    <span className="ml-want-badge" title="해보고 싶음">
                      <Sparkles size={12} aria-hidden /> 해보고 싶음
                    </span>
                  )}
                </span>
                <span className="ml-card-ing">
                  <span className="ml-category">{d.category}</span>
                  {d.ingredients.join(" · ")}
                </span>
                {(d.tags.length > 0 || d.links.length > 0) && (
                  <small>
                    {d.tags.map((t) => `#${t}`).join(" ")}
                    {d.links.length > 0 && (
                      <span className="ml-link-count">
                        <Link2 size={12} aria-hidden /> {d.links.length}
                      </span>
                    )}
                  </small>
                )}
              </span>
              {d.links[0] && <CardThumb url={d.links[0]} demo={demo} />}
            </button>
          ))}
        </section>
      )}

      {opened && (
        <MealDetail
          key={opened.id + opened.version}
          dish={opened}
          demo={demo}
          canEdit={canEdit(opened)}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setOpenId(null);
            setEditing(opened);
          }}
          onDeleted={() => {
            setOpenId(null);
            setDishes(list.filter((d) => d.id !== opened.id));
            setRevision((n) => n + 1);
            inform(`지웠습니다: ${opened.title}`);
          }}
        />
      )}
      {editing && (
        <MealForm
          dish={editing === "new" ? null : editing}
          dishes={list}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            setDishes(
              created
                ? [saved, ...list]
                : list.map((d) => (d.id === saved.id ? saved : d)),
            );
            setRevision((n) => n + 1);
            setOpenId(created ? null : saved.id);
            inform(created ? `추가했습니다: ${saved.title}` : "고쳤습니다.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
