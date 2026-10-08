"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Heart, Maximize2, X } from "lucide-react";
import { ProductArt } from "./product-art";
import {
  wineInfoLinks,
  wineTypeColor,
  type PublicShare,
  type PublicShareWine,
} from "@/lib/wine-cellar";
import { vintageLabel } from "@/lib/format";
// 로그인 없이 보는 공유 페이지. 고른 내용은 이 브라우저에 저장해 두고, 같은 voter_key로 다시 보내면 서버에서 덮어쓴다.
type Saved = {
  voter_key: string;
  name: string;
  comment: string;
  picks: string[];
  sent: string[] | null;
};
const storageKey = (token: string) => `mono-wine-share:${token}`;
function readSaved(token: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function writeSaved(token: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(saved));
  } catch {
    // 사파리 개인 정보 보호 모드 등에서는 저장하지 못한다. 보내기는 그대로 된다.
  }
}
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
function PhotoViewer({
  wine,
  onClose,
}: {
  wine: PublicShareWine;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
      {/* eslint-disable-next-line @next/next/no-img-element -- 공유 토큰으로 검사하는 사진 라우트를 그대로 표시한다. */}
      <img src={wine.photo!} alt={`${wine.name} 사진`} />
    </dialog>
  );
}
// 와인을 잘 모르는 사람이 설명을 읽으러 가는 링크. 새 탭으로 열고 공유 주소(토큰)는 넘기지 않는다.
function WineLinks({ wine }: { wine: PublicShareWine }) {
  const links = wineInfoLinks(wine);
  if (!links.naver && !links.vivino) return null;
  return (
    <div className="share-links">
      {links.naver && (
        <a
          href={links.naver}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${wine.name} 네이버 지식백과에서 보기`}
        >
          지식백과 <ExternalLink size={11} aria-hidden />
        </a>
      )}
      {links.vivino && (
        <a
          href={links.vivino}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${wine.name} Vivino에서 보기`}
        >
          Vivino <ExternalLink size={11} aria-hidden />
        </a>
      )}
    </div>
  );
}
function SendSheet({
  share,
  picks,
  saved,
  onClose,
  onSend,
}: {
  share: PublicShare;
  picks: string[];
  saved: Saved;
  onClose: () => void;
  onSend: (name: string, comment: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(saved.name);
  const [comment, setComment] = useState(saved.comment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const chosen = share.wines.filter((w) => picks.includes(w.id));
  return (
    <dialog
      ref={ref}
      className="record-dialog share-sheet"
      aria-label="고른 와인 보내기"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSend(name.trim(), comment.trim());
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">MY PICKS</span>
            <h2>고른 와인 보내기</h2>
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
        <ol className="share-sheet-picks">
          {chosen.map((w) => (
            <li key={w.id}>
              <b>{w.no}</b>
              <span>{w.name}</span>
            </li>
          ))}
        </ol>
        <div className="form-fields">
          <label className="field field-wide">
            <span>이름</span>
            <input
              required
              maxLength={30}
              value={name}
              autoComplete="nickname"
              placeholder="모임에서 부르는 이름"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field field-wide">
            <span>한마디 (선택)</span>
            <textarea
              rows={3}
              maxLength={300}
              value={comment}
              placeholder="예: 1번은 꼭 마셔보고 싶어요"
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        </div>
        <p className="muted small share-sheet-hint">
          같은 기기에서 다시 보내면 앞서 보낸 선택을 고칩니다.
        </p>
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
            className="button primary share-primary"
            disabled={busy || !name.trim()}
          >
            {busy ? "보내는 중" : saved.sent ? "다시 보내기" : "보내기"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function WineShareView({
  token,
  share,
}: {
  token: string;
  share: PublicShare;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [photo, setPhoto] = useState<PublicShareWine | null>(null);
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState("");
  const [tally, setTally] = useState(share.tally);
  const [voters, setVoters] = useState(share.voters);
  useEffect(() => {
    const stored = readSaved(token);
    const ids = new Set(share.wines.map((w) => w.id));
    const next: Saved = stored ?? {
      voter_key: crypto.randomUUID(),
      name: "",
      comment: "",
      picks: [],
      sent: null,
    };
    // 브라우저 저장소에서 읽는 값이라 첫 렌더 이후에 맞춘다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(next);
    setPicks(next.picks.filter((id) => ids.has(id)).slice(0, share.max_picks));
  }, [token, share]);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(""), 2500);
    return () => window.clearTimeout(t);
  }, [hint]);
  function toggle(id: string) {
    if (!saved) return;
    let next: string[];
    if (picks.includes(id)) next = picks.filter((p) => p !== id);
    else if (picks.length >= share.max_picks) {
      setHint(`최대 ${share.max_picks}개까지 고를 수 있어요.`);
      return;
    } else next = [...picks, id];
    setPicks(next);
    const s = { ...saved, picks: next };
    setSaved(s);
    writeSaved(token, s);
  }
  async function send(name: string, comment: string) {
    if (!saved) return;
    const r = await fetch(`/api/share/wine/${token}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voter_key: saved.voter_key,
        name,
        comment,
        picks,
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(body.error?.message ?? "보내지 못했습니다.");
    const s = { ...saved, name, comment, picks, sent: picks };
    setSaved(s);
    writeSaved(token, s);
    setTally(body.data.tally);
    setVoters(body.data.voters);
    setSending(false);
    setHint("보냈어요. 고마워요!");
  }
  const types = Array.from(new Set(share.wines.map((w) => w.type)));
  const shown = share.wines.filter((w) => !type || w.type === type);
  const sent = saved?.sent ?? null;
  const dirty =
    !sent ||
    sent.length !== picks.length ||
    sent.some((id) => !picks.includes(id));
  return (
    <main id="main-content" className="share-page">
      <header className="share-head">
        <span className="share-eyebrow">
          WINE LIST · {share.wines.length}종
        </span>
        <h1>{share.title}</h1>
        {share.note && <p className="share-note">{share.note}</p>}
        <p className="share-guide">
          마음에 드는 와인을{" "}
          <b>{share.max_picks === 1 ? "하나" : `최대 ${share.max_picks}개`}</b>{" "}
          골라 보내주세요.
          <span>
            {dayLabel(share.expires_at)}까지
            {voters > 0 && ` · ${voters}명 참여`}
          </span>
        </p>
      </header>
      {types.length > 1 && (
        <div className="share-types" role="group" aria-label="종류">
          <button
            type="button"
            aria-pressed={!type}
            onClick={() => setType("")}
          >
            전체 <small>{share.wines.length}</small>
          </button>
          {types.map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={type === t}
              onClick={() => setType(type === t ? "" : t)}
            >
              <i style={{ background: wineTypeColor[t] ?? "#a99" }} />
              {t}{" "}
              <small>{share.wines.filter((w) => w.type === t).length}</small>
            </button>
          ))}
        </div>
      )}
      <ol className="share-grid">
        {shown.map((w) => {
          const picked = picks.includes(w.id);
          const count = tally?.[w.id] ?? 0;
          return (
            <li key={w.id} className="share-card" data-picked={picked}>
              <div className="share-photo">
                <ProductArt kind="wine" name={w.name} imageUrl={w.photo} />
                <span className="share-no" aria-label={`${w.no}번`}>
                  {w.no}
                </span>
                {w.photo && (
                  <button
                    type="button"
                    className="share-zoom"
                    aria-label={`${w.name} 사진 크게 보기`}
                    onClick={() => setPhoto(w)}
                  >
                    <Maximize2 size={15} />
                  </button>
                )}
                {tally && count > 0 && (
                  <span className="share-count">
                    <Heart size={12} fill="currentColor" /> {count}
                  </span>
                )}
              </div>
              <div className="share-info">
                <small>
                  <i style={{ background: wineTypeColor[w.type] ?? "#a99" }} />
                  {w.type} · {vintageLabel(w)}
                  {w.volume_ml && w.volume_ml !== 750
                    ? ` · ${w.volume_ml}ml`
                    : ""}
                </small>
                <h2>{w.name}</h2>
                {w.english_name && <p className="share-en">{w.english_name}</p>}
                <dl>
                  {w.producer && (
                    <div>
                      <dt>생산자</dt>
                      <dd>{w.producer}</dd>
                    </div>
                  )}
                  {(w.country || w.region) && (
                    <div>
                      <dt>산지</dt>
                      <dd>
                        {[w.country, w.region].filter(Boolean).join(" · ")}
                      </dd>
                    </div>
                  )}
                  {w.grapes && (
                    <div>
                      <dt>품종</dt>
                      <dd>{w.grapes}</dd>
                    </div>
                  )}
                  {share.price_display !== "none" && w.price && (
                    <div>
                      <dt>
                        {share.price_display === "band" ? "가격대" : "가격"}
                      </dt>
                      <dd>{w.price}</dd>
                    </div>
                  )}
                </dl>
                <WineLinks wine={w} />
              </div>
              <button
                type="button"
                className="share-pick"
                aria-pressed={picked}
                disabled={!saved}
                onClick={() => toggle(w.id)}
              >
                {picked ? (
                  <>
                    <Check size={16} /> 골랐어요
                  </>
                ) : (
                  <>
                    <Heart size={16} /> 고르기
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="share-foot">MONO 와인 셀러에서 공유한 목록입니다.</p>
      <div className="share-bar" role="status">
        <div>
          <strong>
            {picks.length}/{share.max_picks} 선택
          </strong>
          <span>
            {hint ||
              (sent && !dirty
                ? "보냈어요. 바꾸려면 다시 골라주세요."
                : picks.length
                  ? share.wines
                      .filter((w) => picks.includes(w.id))
                      .map((w) => `${w.no}번`)
                      .join(", ")
                  : "카드의 고르기를 눌러주세요.")}
          </span>
        </div>
        <button
          type="button"
          className="button primary share-primary"
          disabled={!picks.length || !dirty}
          onClick={() => setSending(true)}
        >
          {sent ? (dirty ? "다시 보내기" : "보냈어요") : "보내기"}
        </button>
      </div>
      {sending && saved && (
        <SendSheet
          share={share}
          picks={picks}
          saved={saved}
          onClose={() => setSending(false)}
          onSend={send}
        />
      )}
      {photo && <PhotoViewer wine={photo} onClose={() => setPhoto(null)} />}
    </main>
  );
}
