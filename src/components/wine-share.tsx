"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Heart, Share2, X } from "lucide-react";
import { ProductArt } from "./product-art";
import {
  WINE_SHARE_DAYS,
  WINE_SHARE_MAX_WINES,
  type CellarWine,
  type WineSharePriceDisplay,
  type WineShareSummary,
} from "@/lib/wine-cellar";
import type { Snapshot } from "@/lib/types";
import { dateLabel, vintageLabel } from "@/lib/format";
// 셀러에서 추린 목록을 로그인 없이 볼 수 있는 링크로 만든다. 만들기·끄기는 공통 명령, 목록은 /api/wine/shares.
const shareUrl = (token: string) =>
  `${window.location.origin}/share/wine/${token}`;
const priceOptions: [WineSharePriceDisplay, string, string][] = [
  ["band", "가격대", "3–5만처럼 구간만"],
  ["exact", "정확한 가격", "병당 최근 구입가"],
  ["none", "숨김", "가격을 보여주지 않음"],
];
async function command(operation: string, input: Record<string, unknown>) {
  const r = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
  return body.data;
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(token);
  return (
    <div className="share-link">
      <input
        readOnly
        value={url}
        aria-label="공유 링크"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        className="button secondary small-button"
        onClick={async () => {
          if (await copy(url)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        <Copy size={14} /> {copied ? "복사했어요" : "복사"}
      </button>
      <a
        className="button secondary small-button"
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="공유 페이지 열기"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
export function WineShareCreate({
  wines,
  demo,
  href,
  onClose,
}: {
  wines: CellarWine[];
  demo: boolean;
  href: (url: string) => string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const [title, setTitle] = useState("와인 모임 후보");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(
    () => new Set(wines.slice(0, WINE_SHARE_MAX_WINES).map((w) => w.id)),
  );
  const [price, setPrice] = useState<WineSharePriceDisplay>("band");
  const [maxPicks, setMaxPicks] = useState(Math.min(3, wines.length) || 1);
  const [showResults, setShowResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const ids = wines.filter((w) => selected.has(w.id)).map((w) => w.id);
  const picksLimit = Math.min(10, ids.length);
  const over = ids.length > WINE_SHARE_MAX_WINES;
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    // 입력이 바뀌면 새 작업이다. 같은 키에 다른 내용을 보내면 서버가 거부한다.
    key.current = crypto.randomUUID();
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const share = await command("wine_share_create", {
        idempotency_key: key.current,
        title: title.trim(),
        note: note.trim(),
        wine_ids: ids,
        price_display: price,
        max_picks: Math.min(maxPicks, picksLimit),
        show_results: showResults,
      });
      setToken(share.token);
    } catch (e) {
      setError((e as Error).message);
      key.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="record-dialog share-create"
      aria-label="와인 목록 공유"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!token) submit();
        }}
      >
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">WINE CELLAR / SHARE</span>
            <h2>{token ? "공유 링크를 만들었어요" : "이 목록 공유"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {token ? (
          <>
            <p>
              로그인 없이 누구나 열 수 있습니다. {WINE_SHARE_DAYS}일 뒤에
              닫히고, 공유한 목록에서 언제든 끌 수 있어요.
            </p>
            <CopyLink token={token} />
            <div className="dialog-footer">
              {"share" in navigator && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    navigator
                      .share({ title: title.trim(), url: shareUrl(token) })
                      .catch(() => {})
                  }
                >
                  <Share2 size={15} /> 보내기
                </button>
              )}
              <Link className="button secondary" href={href("/wine/shares")}>
                공유한 목록 보기
              </Link>
              <button
                type="button"
                className="button primary"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              링크를 받은 사람은 로그인 없이 사진·이름·산지·품종을 보고 마음에
              드는 와인을 고릅니다. 재고·구입일·평점·메모는 보이지 않습니다.
              링크는 {WINE_SHARE_DAYS}일 동안 열려 있어요.
            </p>
            <div className="form-fields">
              <label className="field field-wide">
                <span>제목</span>
                <input
                  required
                  maxLength={80}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    key.current = crypto.randomUUID();
                  }}
                />
              </label>
              <label className="field field-wide">
                <span>안내 (선택)</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={note}
                  placeholder="예: 10월 모임에 가져갈 와인을 골라주세요"
                  onChange={(e) => {
                    setNote(e.target.value);
                    key.current = crypto.randomUUID();
                  }}
                />
              </label>
              <fieldset className="field field-wide share-price-options">
                <span>가격 표시</span>
                <div role="radiogroup" aria-label="가격 표시">
                  {priceOptions.map(([value, label, help]) => (
                    <label key={value} data-checked={price === value}>
                      <input
                        type="radio"
                        name="price_display"
                        value={value}
                        checked={price === value}
                        onChange={() => {
                          setPrice(value);
                          key.current = crypto.randomUUID();
                        }}
                      />
                      <b>{label}</b>
                      <small>{help}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="field">
                <span>한 사람이 고를 수 있는 수</span>
                <select
                  value={Math.min(maxPicks, picksLimit)}
                  onChange={(e) => {
                    setMaxPicks(Number(e.target.value));
                    key.current = crypto.randomUUID();
                  }}
                >
                  {Array.from({ length: picksLimit }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}개
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="field share-check">
                <span>결과 공개</span>
                <label className="share-check-row">
                  <input
                    type="checkbox"
                    checked={showResults}
                    onChange={(e) => {
                      setShowResults(e.target.checked);
                      key.current = crypto.randomUUID();
                    }}
                  />
                  받은 사람도 와인별 선택 수를 봅니다
                </label>
              </div>
            </div>
            <div className="share-pick-list">
              <div className="share-pick-head">
                <b>
                  와인 {ids.length}종
                  {wines.length !== ids.length && ` / ${wines.length}종`}
                </b>
                <span>지금 필터 결과 순서대로 번호가 붙습니다.</span>
              </div>
              <ul>
                {wines.map((w, i) => (
                  <li key={w.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(w.id)}
                        onChange={() => toggle(w.id)}
                      />
                      <ProductArt
                        kind="wine"
                        name={w.name}
                        imageUrl={
                          w.has_photo
                            ? `/api/wine/${w.id}/photo?v=${w.version}`
                            : null
                        }
                      />
                      <span>
                        <b>{w.name}</b>
                        <small>
                          {[w.type, vintageLabel(w), w.country]
                            .filter(Boolean)
                            .join(" · ")}
                          {i >= WINE_SHARE_MAX_WINES && " · 60종 초과"}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            {over && (
              <div className="error-box">
                한 번에 {WINE_SHARE_MAX_WINES}종까지 공유할 수 있습니다. 필터로
                더 좁히거나 체크를 풀어주세요.
              </div>
            )}
            {demo && (
              <div className="error-box">
                둘러보기에서는 공유 링크를 만들지 않습니다.
              </div>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
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
                className="button primary"
                disabled={busy || demo || over || !ids.length || !title.trim()}
              >
                <Share2 size={15} /> {busy ? "만드는 중" : "링크 만들기"}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
function status(s: WineShareSummary) {
  if (s.revoked_at) return { label: "꺼짐", tone: "off" };
  if (!s.active) return { label: "끝남", tone: "off" };
  const days = Math.max(
    0,
    Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000),
  );
  return { label: days ? `D-${days}` : "오늘 마감", tone: "on" };
}
function ShareCard({
  share,
  data,
  canRevoke,
  onRevoke,
}: {
  share: WineShareSummary;
  data: Snapshot;
  canRevoke: boolean;
  onRevoke: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const st = status(share);
  const wines = new Map(data.wines.map((w) => [w.id, w]));
  const counts = new Map<string, string[]>();
  for (const v of share.votes)
    for (const id of v.picks)
      counts.set(id, [...(counts.get(id) ?? []), v.name]);
  const ranked = share.wine_ids
    .map((id, i) => ({
      id,
      no: i + 1,
      wine: wines.get(id),
      voters: counts.get(id) ?? [],
    }))
    .sort((a, b) => b.voters.length - a.voters.length || a.no - b.no);
  const top = ranked[0]?.voters.length ?? 0;
  const numberOf = (id: string) => share.wine_ids.indexOf(id) + 1;
  return (
    <article className="panel share-admin-card" data-active={share.active}>
      <header>
        <div>
          <span className={`share-status share-status-${st.tone}`}>
            {st.label}
          </span>
          <h3>{share.title}</h3>
          <p className="muted small">
            {dateLabel(share.created_at)} · {share.created_by_name ?? "가족"} ·
            와인 {share.wine_ids.length}종 · 최대 {share.max_picks}개 ·{" "}
            {priceOptions.find((p) => p[0] === share.price_display)?.[1]}
            {share.show_results && " · 결과 공개"}
          </p>
          {share.note && <p className="share-admin-note">{share.note}</p>}
        </div>
        <strong className="share-admin-voters">
          {share.votes.length}
          <small>명 참여</small>
        </strong>
      </header>
      {share.active && <CopyLink token={share.token} />}
      {share.votes.length > 0 ? (
        <>
          <ol className="share-ranking">
            {ranked
              .filter((r) => r.voters.length)
              .map((r) => (
                <li key={r.id}>
                  <span className="share-ranking-no">{r.no}</span>
                  <div>
                    <b>{r.wine?.name ?? "삭제된 와인"}</b>
                    <i style={{ width: `${(r.voters.length / top) * 100}%` }} />
                    <small>{r.voters.join(", ")}</small>
                  </div>
                  <strong>
                    <Heart size={12} fill="currentColor" /> {r.voters.length}
                  </strong>
                </li>
              ))}
          </ol>
          <ul className="share-comments">
            {share.votes.map((v) => (
              <li key={v.name + v.updated_at}>
                <b>{v.name}</b>
                <span>
                  {v.picks.map((id) => `${numberOf(id)}번`).join(", ")}
                </span>
                {v.comment && <p>{v.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted small">아직 고른 사람이 없어요.</p>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {share.active && canRevoke && (
        <div className="share-admin-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "이 링크를 끌까요? 받은 사람은 더 이상 볼 수 없습니다.",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                await onRevoke();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            링크 끄기
          </button>
        </div>
      )}
    </article>
  );
}
export function WineShares({
  data,
  demo,
  href,
}: {
  data: Snapshot;
  demo: boolean;
  href: (url: string) => string;
}) {
  const [shares, setShares] = useState<WineShareSummary[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (demo) {
      setShares([]);
      return;
    }
    try {
      const r = await fetch("/api/wine/shares", { cache: "no-store" });
      if (r.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 세션이 끝나면 전체 이동으로 캐시를 비운다.
        window.location.assign("/login");
        return;
      }
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
      setShares(body.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [demo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (error)
    return (
      <div className="error-box" role="alert">
        {error}
      </div>
    );
  if (!shares) return <p className="muted">불러오는 중…</p>;
  if (!shares.length)
    return (
      <div className="panel empty-state">
        <h2>공유한 목록이 없어요</h2>
        <p>
          {demo
            ? "둘러보기에서는 공유 링크를 만들지 않습니다."
            : '나의 셀러에서 필터로 와인을 추린 뒤 결과 줄의 "공유"를 눌러보세요.'}
        </p>
        <Link className="button secondary" href={href("/wine")}>
          나의 셀러로
        </Link>
      </div>
    );
  return (
    <div className="share-admin">
      {shares.map((s) => (
        <ShareCard
          key={s.id}
          share={s}
          data={data}
          canRevoke={
            data.user.role === "owner" || s.created_by === data.user.id
          }
          onRevoke={async () => {
            await command("wine_share_revoke", {
              idempotency_key: crypto.randomUUID(),
              id: s.id,
            });
            await load();
          }}
        />
      ))}
    </div>
  );
}
