"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Droplet,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import {
  bleedingAmounts,
  bleedingColors,
  bleedingLabel,
  CALL_PER_20_MIN,
  CALL_PER_HOUR,
  colorLabel,
  durationSec,
  intensityLabel,
  kindLabel,
  kindStats,
  MAX_DURATION_MIN,
  MAX_PHOTOS,
  pregnancyKinds,
  pregnancyLevel,
  pregnancyWeek,
  SESSION_GAP_MIN,
  symptomEpisodes,
  symptomStats,
  TERM_WEEKS,
  timedKinds,
  WATCH_PER_HOUR,
  withIntervals,
  type BleedingAmount,
  type BleedingColor,
  type PregnancyData,
  type PregnancyEvent,
  type PregnancyKind,
  type TimedKind,
} from "@/lib/pregnancy";
import { demoPregnancy } from "@/lib/demo-pregnancy";

const MIN = 60000;
type Running = { started_at: string; key: string };
type RunningMap = Partial<Record<TimedKind, Running>>;
// 종료했지만 아직 서버에 저장하지 못한 기록. 같은 request_key로 다시 보낸다.
type Pending = {
  request_key: string;
  kind: TimedKind;
  started_at: string;
  ended_at: string;
  intensity: number | null;
  memo: string;
};
type Range = "hour" | "today" | "all";
// 타입별 보기의 선택. "both"는 배뭉침·통증을 한 타임라인에 모아 본다(출혈 제외).
type ViewKind = PregnancyKind | "both";
type Sheet =
  | {
      type: "stop";
      key: string;
      kind: TimedKind;
      started_at: string;
      ended_at: string;
    }
  | {
      type: "timed";
      event?: PregnancyEvent;
      kind: TimedKind;
      started_at: string;
      ended_at: string;
      key?: string;
      note?: string;
    }
  | { type: "bleeding"; event?: PregnancyEvent }
  | { type: "settings" }
  | { type: "photos"; ids: string[]; index: number };

// 진행 중 타이머와 저장 대기 기록은 입력하는 기기의 브라우저에 둔다.
// 페이지를 새로고침하거나 브라우저가 탭을 다시 불러와도 시작 시각이 남는다.
const storeKey = (userId: string, name: string) =>
  `mono:kkomi:${name}:v1:${userId}`;
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소를 쓸 수 없는 브라우저에서는 화면 상태로만 유지한다.
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (iso: string | number) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))}`;
// 간격은 시각(18:00)과 헷갈리지 않게 분·초로 쓴다.
const gap = (sec: number) => {
  const m = Math.floor(sec / 60),
    r = Math.round(sec % 60);
  return m ? (r ? `${m}분 ${r}초` : `${m}분`) : `${r}초`;
};
// 기록 사이 빈 시간. 한 시간이 넘으면 시간·분으로 쓴다.
const quietText = (sec: number) => {
  const m = Math.round(sec / 60),
    h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`) : `${m}분`;
};
const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`;
};
const agoText = (iso: string, now: number) => {
  const m = Math.round((now - new Date(iso).getTime()) / MIN);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
  return dayLabel(iso);
};
const toLocalInput = (iso: string, seconds = true) => {
  const d = new Date(iso);
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return seconds ? `${base}:${pad(d.getSeconds())}` : base;
};
const fromLocalInput = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const kindColor = (k: PregnancyKind) =>
  k === "tightening"
    ? "var(--pg-tight)"
    : k === "pain"
      ? "var(--pg-pain)"
      : "var(--pg-blood)";

async function photoBase64(file: File) {
  if (file.size > 20000000) throw Error("20MB 이하의 사진을 선택해주세요.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("사진을 처리할 수 없습니다.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
}

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function post(body: Record<string, unknown>) {
  let r: Response;
  try {
    r = await fetch("/api/baby/pregnancy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RequestError("연결이 불안정합니다.", 0);
  }
  const result = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new RequestError(
      result.error?.message ?? "저장하지 못했습니다.",
      r.status,
    );
  return result;
}
const timedPayload = (e: PregnancyEvent) => ({
  kind: e.kind,
  started_at: e.started_at,
  ended_at: e.ended_at,
  intensity: e.intensity,
  memo: e.memo,
});

export function PregnancyLog({
  demo,
  userId,
  initialQuery,
}: {
  demo: boolean;
  userId: string;
  initialQuery: Record<string, string>;
}) {
  const [data, setData] = useState<PregnancyData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [running, setRunning] = useState<RunningMap>({});
  const [pending, setPending] = useState<Pending[]>([]);
  const [tab, setTab] = useState<"now" | "type">(
    initialQuery.tab === "type" ? "type" : "now",
  );
  const [kind, setKind] = useState<ViewKind>(
    pregnancyKinds.includes(initialQuery.kind as PregnancyKind)
      ? (initialQuery.kind as PregnancyKind)
      : "both",
  );
  const [range, setRange] = useState<Range>(
    initialQuery.range === "hour" || initialQuery.range === "all"
      ? initialQuery.range
      : "today",
  );
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => void;
  } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toastTimer = useRef<number>(0);
  const inflight = useRef(new Map<string, Promise<PregnancyEvent | null>>());
  const savedByKey = useRef(new Map<string, PregnancyEvent>());
  const runningKey = storeKey(userId, "running");
  const pendingKey = storeKey(userId, "pending");

  const inform = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  const updatePending = useCallback(
    (fn: (list: Pending[]) => Pending[]) => {
      const next = fn(readStore<Pending[]>(pendingKey, []));
      writeStore(pendingKey, next);
      setPending(next);
      return next;
    },
    [pendingKey],
  );
  const upsert = useCallback((event: PregnancyEvent) => {
    setData((d) =>
      d
        ? {
            ...d,
            events: [event, ...d.events.filter((e) => e.id !== event.id)].sort(
              (a, b) => b.started_at.localeCompare(a.started_at),
            ),
          }
        : d,
    );
  }, []);

  const load = useCallback(async () => {
    if (demo) {
      setData(demoPregnancy(Date.now()));
      return;
    }
    try {
      const r = await fetch("/api/baby/pregnancy", { cache: "no-store" });
      if (r.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 세션이 끝나면 전체 이동으로 캐시를 비운다.
        window.location.assign("/login");
        return;
      }
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
      setData(body);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message || "불러오지 못했습니다.");
    }
  }, [demo]);

  // 저장 대기 기록을 차례로 보낸다. 연결이 끊기면 멈추고 다음 기회에 이어간다.
  const flush = useCallback(async () => {
    if (demo) return;
    for (const p of readStore<Pending[]>(pendingKey, [])) {
      if (inflight.current.has(p.request_key)) continue;
      const task = post({ action: "create", ...p })
        .then((r) => {
          updatePending((l) =>
            l.filter((x) => x.request_key !== p.request_key),
          );
          savedByKey.current.set(p.request_key, r.event);
          upsert(r.event);
          return r.event as PregnancyEvent;
        })
        .catch((e: RequestError) => {
          if (e.status >= 400 && e.status < 500 && e.status !== 429) {
            updatePending((l) =>
              l.filter((x) => x.request_key !== p.request_key),
            );
            inform(
              `${kindLabel[p.kind]} ${hm(p.started_at)} 기록을 저장하지 못했습니다: ${e.message}`,
            );
          }
          return null;
        })
        .finally(() => inflight.current.delete(p.request_key));
      inflight.current.set(p.request_key, task);
      if (!(await task)) break;
    }
  }, [demo, pendingKey, updatePending, upsert, inform]);

  useEffect(() => {
    // 브라우저 저장소는 마운트 후에만 읽을 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(readStore<RunningMap>(runningKey, {}));
    setPending(readStore<Pending[]>(pendingKey, []));
    load().then(flush);
    const online = () => flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [runningKey, pendingKey, load, flush]);

  const anyRunning = Boolean(running.tightening || running.pain);
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Date.now()),
      anyRunning ? 1000 : 30000,
    );
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // 기록 중에는 화면이 꺼지지 않게 요청한다. 지원하지 않는 브라우저는 그대로 둔다.
  useEffect(() => {
    if (!anyRunning || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [anyRunning]);

  const setQuery = (key: string, value: string, fallback: string) => {
    const url = new URL(window.location.href);
    if (value === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  };
  const saveRunning = (next: RunningMap) => {
    writeStore(runningKey, next);
    setRunning(next);
  };

  function toggle(k: TimedKind) {
    if (demo) {
      inform("둘러보기에서는 기록하지 않습니다. 로그인 후 이용해주세요.");
      return;
    }
    const current = readStore<RunningMap>(runningKey, {});
    const r = current[k];
    if (!r) {
      const started = {
        started_at: new Date().toISOString(),
        key: crypto.randomUUID(),
      };
      saveRunning({ ...current, [k]: started });
      setNow(Date.now());
      inform(`${kindLabel[k]} 시작 ${hm(started.started_at)}`, () =>
        saveRunning({
          ...readStore<RunningMap>(runningKey, {}),
          [k]: undefined,
        }),
      );
      return;
    }
    const ended = new Date();
    const next = { ...current };
    delete next[k];
    saveRunning(next);
    setToast(null);
    const start = new Date(r.started_at).getTime();
    if (ended.getTime() - start > MAX_DURATION_MIN * MIN) {
      setSheet({
        type: "timed",
        kind: k,
        started_at: r.started_at,
        ended_at: new Date(start + 60000).toISOString(),
        key: r.key,
        note: `${MAX_DURATION_MIN}분 넘게 켜져 있었습니다. 실제로 끝난 시각으로 고쳐 저장하세요.`,
      });
      return;
    }
    const p: Pending = {
      request_key: r.key,
      kind: k,
      started_at: r.started_at,
      ended_at: new Date(Math.max(ended.getTime(), start + 1000)).toISOString(),
      intensity: null,
      memo: "",
    };
    updatePending((l) => [
      ...l.filter((x) => x.request_key !== p.request_key),
      p,
    ]);
    setSheet({
      type: "stop",
      key: p.request_key,
      kind: k,
      started_at: p.started_at,
      ended_at: p.ended_at,
    });
    flush().then(() => {
      if (
        readStore<Pending[]>(pendingKey, []).some(
          (x) => x.request_key === p.request_key,
        )
      )
        inform(
          "연결이 불안정해 이 기기에 보관했습니다. 다시 연결되면 저장합니다.",
        );
    });
  }

  // 종료 직후 시트: 이미 저장된 기록이면 수정하고, 아직 대기 중이면 대기 기록을 고친다.
  async function finishStop(
    key: string,
    intensity: number | null,
    memo: string,
    remove = false,
  ) {
    const target =
      (await inflight.current.get(key)) ?? savedByKey.current.get(key) ?? null;
    if (!target) {
      updatePending((l) =>
        remove
          ? l.filter((x) => x.request_key !== key)
          : l.map((x) =>
              x.request_key === key ? { ...x, intensity, memo } : x,
            ),
      );
      if (!remove) flush();
      setSheet(null);
      return;
    }
    try {
      if (remove) {
        await post({
          action: "delete",
          id: target.id,
          expected_version: target.version,
        });
        setData(
          (d) =>
            d && { ...d, events: d.events.filter((e) => e.id !== target.id) },
        );
        inform(`${kindLabel[target.kind]} 기록을 삭제했습니다.`);
      } else if (intensity !== null || memo) {
        const r = await post({
          action: "update",
          id: target.id,
          expected_version: target.version,
          ...timedPayload(target),
          intensity,
          memo,
        });
        upsert(r.event);
      }
      savedByKey.current.delete(key);
      setSheet(null);
    } catch (e) {
      inform((e as Error).message);
    }
  }

  async function saveTimed(
    sheetValue: Extract<Sheet, { type: "timed" }>,
    values: {
      kind: TimedKind;
      started_at: string;
      ended_at: string;
      intensity: number | null;
      memo: string;
    },
  ) {
    const r = sheetValue.event
      ? await post({
          action: "update",
          id: sheetValue.event.id,
          expected_version: sheetValue.event.version,
          ...values,
        })
      : await post({
          action: "create",
          request_key: sheetValue.key ?? crypto.randomUUID(),
          ...values,
        });
    upsert(r.event);
    setSheet(null);
    inform(`${kindLabel[values.kind]} ${hm(values.started_at)} 저장`);
  }
  async function removeEvent(e: PregnancyEvent) {
    await post({ action: "delete", id: e.id, expected_version: e.version });
    setData(
      (d) => d && { ...d, events: d.events.filter((x) => x.id !== e.id) },
    );
    setSheet(null);
    inform(`${kindLabel[e.kind]} 기록을 삭제했습니다.`);
  }

  if (!data)
    return (
      <div className="pg-page">
        <Heading data={null} now={now} onSettings={() => {}} />
        <div className="panel pg-state">
          {loadError ? (
            <>
              <p>{loadError}</p>
              <button
                className="button secondary"
                onClick={() => load().then(flush)}
              >
                <RefreshCw size={16} /> 다시 시도
              </button>
            </>
          ) : (
            <p className="muted">기록을 불러오는 중입니다.</p>
          )}
        </div>
      </div>
    );

  const events = data.events;
  const week = pregnancyWeek(data.settings.due_date, now);

  return (
    <div className="pg-page">
      <Heading
        data={data}
        now={now}
        onSettings={() => setSheet({ type: "settings" })}
      />
      <div className="pg-tabs" role="tablist" aria-label="보기 전환">
        {(
          [
            ["now", "지금 기록"],
            ["type", "타입별 보기"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setQuery("tab", value, "now");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "now" ? (
        <NowView
          events={events}
          now={now}
          running={running}
          pending={pending}
          termWeek={week ? week.weeks >= TERM_WEEKS : false}
          onToggle={toggle}
          onRetry={() => flush()}
          onBleeding={() => setSheet({ type: "bleeding" })}
          onManual={() => {
            const end = Date.now() - 5 * MIN;
            setSheet({
              type: "timed",
              kind: "tightening",
              started_at: new Date(end - 40000).toISOString(),
              ended_at: new Date(end).toISOString(),
            });
          }}
          onEdit={(e) => openEdit(e)}
        />
      ) : (
        <TypeView
          events={events}
          now={now}
          kind={kind}
          range={range}
          revealed={revealed}
          demo={demo}
          onKind={(k) => {
            setKind(k);
            setQuery("kind", k, "both");
          }}
          onRange={(r) => {
            setRange(r);
            setQuery("range", r, "today");
          }}
          onReveal={(id, ids) =>
            revealed[id]
              ? setSheet({ type: "photos", ids, index: 0 })
              : setRevealed((v) => ({ ...v, [id]: true }))
          }
          onEdit={(e) => openEdit(e)}
        />
      )}
      <p className="pg-disclaimer">
        상태 표시는 기록을 정리한 참고용이며 진단이 아닙니다. 선홍색 출혈, 많은
        출혈, 물 같은 분비물, 아기가 밀고 내려오는 듯한 압박이 있으면 기록보다
        병원 연락이 먼저입니다.
      </p>

      {sheet && sheet.type !== "photos" && (
        <div className="pg-shade" onClick={() => setSheet(null)} />
      )}
      {sheet?.type === "stop" && (
        <StopSheet
          key={sheet.key}
          sheet={sheet}
          onDone={(i, m) => finishStop(sheet.key, i, m)}
          onDelete={() => finishStop(sheet.key, null, "", true)}
        />
      )}
      {sheet?.type === "timed" && (
        <TimedSheet
          key={sheet.event?.id ?? sheet.key ?? "new"}
          sheet={sheet}
          onSave={(v) => saveTimed(sheet, v)}
          onDelete={sheet.event ? () => removeEvent(sheet.event!) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "bleeding" && (
        <BleedingSheet
          key={sheet.event?.id ?? "new"}
          event={sheet.event}
          demo={demo}
          onSaved={(e) => {
            upsert(e);
            setSheet(null);
            inform(
              `${e.bleeding === "none" ? "출혈 없음" : "출혈"} ${hm(e.started_at)} 저장${e.photo_ids.length ? ` · 사진 ${e.photo_ids.length}장` : ""}`,
            );
          }}
          onDelete={sheet.event ? () => removeEvent(sheet.event!) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "settings" && (
        <SettingsSheet
          data={data}
          demo={demo}
          onSaved={(settings) => {
            setData((d) => d && { ...d, settings });
            setSheet(null);
            inform("출산예정일을 저장했습니다.");
          }}
          onConflict={() => load()}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "photos" && (
        <PhotoViewer
          ids={sheet.ids}
          index={sheet.index}
          demo={demo}
          onIndex={(index) => setSheet({ ...sheet, index })}
          onClose={() => setSheet(null)}
        />
      )}
      {toast && (
        <div className="pg-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );

  function openEdit(e: PregnancyEvent) {
    if (!e.can_edit) {
      inform(
        demo
          ? "둘러보기에서는 수정하지 않습니다."
          : "기록한 사람 또는 관리자만 수정할 수 있습니다.",
      );
      return;
    }
    if (e.kind === "bleeding") setSheet({ type: "bleeding", event: e });
    else
      setSheet({
        type: "timed",
        event: e,
        kind: e.kind,
        started_at: e.started_at,
        ended_at: e.ended_at!,
      });
  }
}

function Heading({
  data,
  now,
  onSettings,
}: {
  data: PregnancyData | null;
  now: number;
  onSettings: () => void;
}) {
  const week = data ? pregnancyWeek(data.settings.due_date, now) : null;
  return (
    <div className="page-heading pg-heading">
      <div>
        <span className="eyebrow">MONO / KKOMI</span>
        <h1>
          임신 중 통증 기록<span className="heading-dot">.</span>
        </h1>
      </div>
      {data && (
        <div className="pg-heading-actions">
          <button type="button" className="pg-week" onClick={onSettings}>
            {week ? `${week.weeks}주 ${week.days}일` : "출산예정일 입력"}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="출산예정일 설정"
            onClick={onSettings}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

const levelText = {
  calm: "기준 미만",
  watch: "잦아지는 중",
  call: "병원 연락 권장",
} as const;

function NowView({
  events,
  now,
  running,
  pending,
  termWeek,
  onToggle,
  onRetry,
  onBleeding,
  onManual,
  onEdit,
}: {
  events: PregnancyEvent[];
  now: number;
  running: RunningMap;
  pending: Pending[];
  termWeek: boolean;
  onToggle: (k: TimedKind) => void;
  onRetry: () => void;
  onBleeding: () => void;
  onManual: () => void;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const level = pregnancyLevel(events, now);
  const guide = {
    calm: "편하게 누워 계속 기록하세요. 배뭉침은 보통 10~20초 안에 풀립니다.",
    watch: `최근 1시간 ${WATCH_PER_HOUR}회 기준에 닿았습니다. 안정을 취한 뒤에도 계속되면 병원에 연락하세요.`,
    call: termWeek
      ? `20분 ${CALL_PER_20_MIN}회 또는 1시간 ${CALL_PER_HOUR}회에 닿았습니다. 만삭이라면 5분 간격·1분 지속이 1시간 이어지는지 함께 보고 분만실에 연락하세요.`
      : `20분 ${CALL_PER_20_MIN}회 또는 1시간 ${CALL_PER_HOUR}회에 닿았습니다. 다니는 병원 분만실에 연락하세요.`,
  }[level];
  const intervals = new Map<string, number | null>();
  for (const k of timedKinds)
    for (const e of withIntervals(events, k)) intervals.set(e.id, e.interval);
  return (
    <div className="pg-now">
      <div className="pg-col">
        <section className="pg-card pg-status" aria-label="최근 1시간 요약">
          <div className="pg-status-top">
            <span>최근 1시간</span>
            <span className={`pg-pill ${level}`}>{levelText[level]}</span>
          </div>
          <div className="pg-pair">
            {timedKinds.map((k) => {
              const s = kindStats(events, k, now - 60 * MIN);
              return (
                <div className="pg-metric" key={k}>
                  <span className="pg-metric-k">
                    <i className={`pg-dot ${k}`} />
                    {kindLabel[k]}
                  </span>
                  <span className="pg-metric-v">
                    {s.count}
                    <small>회</small>
                  </span>
                  <span className="pg-metric-s">
                    간격 {s.avgInterval ? gap(s.avgInterval) : "—"} · 지속{" "}
                    {s.avgDuration ? clock(s.avgDuration) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="pg-guide">{guide}</p>
        </section>
        {pending.length > 0 && (
          <div className="pg-pending" role="status">
            <span>이 기기에 저장 대기 {pending.length}건</span>
            <button type="button" onClick={onRetry}>
              지금 저장
            </button>
          </div>
        )}
        <div className="pg-tiles">
          {timedKinds.map((k) => {
            const r = running[k];
            const last = events.find((e) => e.kind === k);
            return (
              <button
                key={k}
                type="button"
                className={`pg-tile ${k}${r ? " running" : ""}`}
                onClick={() => onToggle(k)}
                aria-label={`${kindLabel[k]} ${r ? "종료" : "시작"}`}
              >
                <span className="pg-tile-icon">
                  {k === "tightening" ? (
                    <CircleDot size={22} />
                  ) : (
                    <Zap size={22} />
                  )}
                </span>
                {r ? (
                  <>
                    <span className="pg-elapsed">
                      {clock(
                        Math.max(
                          0,
                          (now - new Date(r.started_at).getTime()) / 1000,
                        ),
                      )}
                    </span>
                    <span>
                      <span className="pg-tile-name">{kindLabel[k]}</span>
                      <span className="pg-tile-cta">
                        탭해서 종료 · {hm(r.started_at)} 시작
                      </span>
                    </span>
                  </>
                ) : (
                  <span>
                    <span className="pg-tile-name">{kindLabel[k]}</span>
                    <span className="pg-tile-cta">탭해서 시작</span>
                    <span className="pg-tile-last">
                      {last
                        ? `마지막 ${agoText(last.started_at, now)} · ${clock(durationSec(last) ?? 0)}`
                        : "기록 없음"}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="pg-quick">
          <button type="button" className="pg-quick-blood" onClick={onBleeding}>
            <Droplet size={18} />
            출혈 기록
          </button>
          <button type="button" onClick={onManual}>
            <Pencil size={17} />
            직접 입력
          </button>
        </div>
      </div>
      <div className="pg-col">
        <section className="pg-card" aria-label="최근 3시간 흐름">
          <div className="pg-sec-title">
            최근 3시간 흐름
            <small>
              {hm(now - 180 * MIN)} – {hm(now)}
            </small>
          </div>
          <Strip events={events} now={now} running={running} />
          <div className="pg-legend">
            {pregnancyKinds.map((k) => (
              <span key={k}>
                <i className={`pg-dot ${k}`} />
                {kindLabel[k]}
              </span>
            ))}
          </div>
        </section>
        <section className="pg-card">
          <div className="pg-sec-title">
            최근 기록<small>누르면 수정</small>
          </div>
          {events.length ? (
            <div className="pg-rows">
              {events.slice(0, 8).map((e) => (
                <EventRow
                  key={e.id}
                  e={e}
                  interval={intervals.get(e.id) ?? null}
                  onClick={() => onEdit(e)}
                />
              ))}
            </div>
          ) : (
            <p className="pg-empty">
              배뭉침이나 통증이 시작되면 위의 타일을 눌러주세요.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Bolts({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span className="pg-bolts" aria-label={`강도 ${intensityLabel[n - 1]}`}>
      {Array.from({ length: n }, (_, i) => (
        <Zap key={i} size={11} />
      ))}
    </span>
  );
}

function EventRow({
  e,
  interval,
  onClick,
}: {
  e: PregnancyEvent;
  interval: number | null;
  onClick: () => void;
}) {
  const d = durationSec(e);
  const sub = [e.created_by_name, e.memo].filter(Boolean).join(" · ");
  return (
    <button type="button" className="pg-row" onClick={onClick}>
      <span className="pg-row-time">{hm(e.started_at)}</span>
      <span className="pg-row-what">
        <span>
          <i className={`pg-dot ${e.kind}`} />
          {e.kind === "bleeding" && e.bleeding === "none"
            ? "출혈 확인"
            : kindLabel[e.kind]}
          <Bolts n={e.intensity} />
        </span>
        {sub && <em>{sub}</em>}
      </span>
      <span className="pg-row-meta">
        {e.kind === "bleeding" ? (
          <>
            <b>{e.bleeding ? bleedingLabel[e.bleeding] : ""}</b>
            {e.photo_ids.length > 0 && <span>사진 {e.photo_ids.length}장</span>}
          </>
        ) : (
          <>
            <b>{d !== null ? clock(d) : ""}</b>
            <span>{interval ? `간격 ${gap(interval)}` : "새 구간"}</span>
          </>
        )}
      </span>
    </button>
  );
}

function Strip({
  events,
  now,
  running,
}: {
  events: PregnancyEvent[];
  now: number;
  running: RunningMap;
}) {
  const W = 340,
    L = 44,
    R = 8,
    span = 180 * MIN;
  const x = (v: number) => L + ((v - (now - span)) / span) * (W - L - R);
  const lane = { tightening: 22, pain: 48, bleeding: 72 };
  const bars = events.filter(
    (e) => new Date(e.started_at).getTime() >= now - span,
  );
  return (
    <svg
      className="pg-strip"
      viewBox={`0 0 ${W} 104`}
      role="img"
      aria-label="최근 3시간 동안의 기록 막대"
    >
      {[0, 1, 2, 3].map((h) => {
        const xt = x(now - span + h * 60 * MIN);
        return (
          <g key={h}>
            <line x1={xt} y1={8} x2={xt} y2={84} stroke="var(--line)" />
            <text
              x={xt}
              y={98}
              fontSize={10}
              fill="var(--pg-faint)"
              textAnchor={h === 0 ? "start" : h === 3 ? "end" : "middle"}
            >
              {h === 3 ? "지금" : hm(now - span + h * 60 * MIN)}
            </text>
          </g>
        );
      })}
      {pregnancyKinds.map((k) => (
        <text key={k} x={0} y={lane[k] + 4} fontSize={10.5} fill="var(--muted)">
          {kindLabel[k]}
        </text>
      ))}
      {bars.map((e) => {
        const s = new Date(e.started_at).getTime();
        if (e.kind === "bleeding")
          return e.bleeding === "none" ? (
            <circle
              key={e.id}
              cx={x(s)}
              cy={lane.bleeding}
              r={4}
              fill="var(--white)"
              stroke="var(--pg-blood)"
              strokeWidth={1.5}
            />
          ) : (
            <circle
              key={e.id}
              cx={x(s)}
              cy={lane.bleeding}
              r={4.5}
              fill="var(--pg-blood)"
            />
          );
        const end = e.ended_at ? new Date(e.ended_at).getTime() : s;
        return (
          <rect
            key={e.id}
            x={x(s)}
            y={lane[e.kind] - 8}
            width={Math.max(4, x(end) - x(s))}
            height={16}
            rx={3}
            fill={kindColor(e.kind)}
          />
        );
      })}
      {timedKinds.map((k) => {
        const r = running[k];
        if (!r) return null;
        const s = Math.max(new Date(r.started_at).getTime(), now - span);
        return (
          <rect
            key={`run-${k}`}
            x={x(s)}
            y={lane[k] - 8}
            width={Math.max(4, x(now) - x(s))}
            height={16}
            rx={3}
            fill={kindColor(k)}
            opacity={0.5}
          />
        );
      })}
    </svg>
  );
}

function TypeView({
  events,
  now,
  kind,
  range,
  revealed,
  demo,
  onKind,
  onRange,
  onReveal,
  onEdit,
}: {
  events: PregnancyEvent[];
  now: number;
  kind: ViewKind;
  range: Range;
  revealed: Record<string, boolean>;
  demo: boolean;
  onKind: (k: ViewKind) => void;
  onRange: (r: Range) => void;
  onReveal: (id: string, ids: string[]) => void;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const from =
    range === "hour" ? now - 60 * MIN : range === "today" ? today.getTime() : 0;
  return (
    <div className="pg-type">
      <div className="pg-seg" role="tablist" aria-label="기록 타입">
        <button
          type="button"
          role="tab"
          className="both"
          aria-selected={kind === "both"}
          onClick={() => onKind("both")}
        >
          배뭉침·통증
        </button>
        {pregnancyKinds.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            className={k}
            aria-selected={k === kind}
            onClick={() => onKind(k)}
          >
            <i className={`pg-dot ${k}`} />
            {kindLabel[k]}
          </button>
        ))}
      </div>
      <div className="pg-range" role="group" aria-label="기간">
        {(
          [
            ["hour", "최근 1시간"],
            ["today", "오늘"],
            ["all", "전체"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => onRange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "both" ? (
        <CombinedView events={events} from={from} now={now} onEdit={onEdit} />
      ) : kind === "bleeding" ? (
        <BleedingList
          events={events.filter(
            (e) =>
              e.kind === "bleeding" && new Date(e.started_at).getTime() >= from,
          )}
          revealed={revealed}
          demo={demo}
          onReveal={onReveal}
          onEdit={onEdit}
        />
      ) : (
        <Timeline
          events={events}
          kind={kind}
          from={from}
          now={now}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

// 배뭉침·통증을 하나의 증상으로 합쳐 본다. 번호·간격·요약은 두 타입을 구분하지 않고
// 증상 단위(symptomEpisodes)로 센다. 시간이 겹친 기록은 한 번의 증상으로 묶어 같은 번호를 쓴다.
// 출혈은 성격이 달라 출혈 탭에서만 본다.
function CombinedView({
  events,
  from,
  now,
  onEdit,
}: {
  events: PregnancyEvent[];
  from: number;
  now: number;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const stats = symptomStats(events, from);
  const byKind = { tightening: 0, pain: 0 };
  for (const ep of stats.list)
    for (const e of ep.events) byKind[e.kind as TimedKind]++;
  const episodes = stats.list.map((ep, i) => ({ ...ep, n: i + 1 })).reverse();
  const perDay = new Map<string, number>();
  for (const ep of episodes) {
    const key = dayKey(new Date(ep.start).toISOString());
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const items: React.ReactNode[] = [];
  episodes.forEach((ep, i) => {
    const iso = new Date(ep.start).toISOString();
    const day = dayKey(iso);
    if (
      i === 0 ||
      dayKey(new Date(episodes[i - 1].start).toISOString()) !== day
    )
      items.push(
        <div className="pg-day" key={`d-${day}`}>
          <span>{dayLabel(iso)}</span>
          <span>{perDay.get(day)}회</span>
        </div>,
      );
    const rows = ep.events.slice().reverse();
    rows.forEach((e, j) => {
      const first = j === rows.length - 1;
      items.push(
        <SymptomRow
          key={e.id}
          e={e}
          n={ep.n}
          interval={first ? ep.interval : null}
          together={!first || rows.length > 1}
          lead={first}
          onEdit={onEdit}
        />,
      );
    });
    const next = episodes[i + 1];
    if (next && dayKey(new Date(next.start).toISOString()) === day) {
      const quiet = (ep.start - next.end) / 1000;
      if (quiet > SESSION_GAP_MIN * 60)
        items.push(
          <div className="pg-gap" key={`g-${ep.start}`}>
            {quietText(quiet)} 동안 기록 없음
          </div>,
        );
    }
  });
  return (
    <>
      <div className="pg-sum3">
        <div>
          <small>증상 횟수</small>
          <b>{stats.count}회</b>
          <span className="pg-sum-sub">
            <i className="pg-dot tightening" />
            {byKind.tightening} <i className="pg-dot pain" />
            {byKind.pain}
          </span>
        </div>
        <div>
          <small>평균 간격</small>
          <b>{stats.avgInterval ? gap(stats.avgInterval) : "—"}</b>
        </div>
        <div>
          <small>평균 지속</small>
          <b>{stats.avgDuration ? clock(stats.avgDuration) : "—"}</b>
        </div>
      </div>
      <section className="pg-card">
        <div className="pg-sec-title">
          오늘 시간대별 증상 횟수
          <small>점선은 1시간 {WATCH_PER_HOUR}회</small>
        </div>
        <SymptomHistogram events={events} now={now} />
      </section>
      <section className="pg-card pg-tl">
        {items.length ? (
          items
        ) : (
          <p className="pg-empty">이 기간에 기록이 없습니다.</p>
        )}
      </section>
    </>
  );
}

// 합친 보기의 한 줄. 증상의 첫 기록만 간격을 보이고, 함께 묶인 기록은 같은 번호를 흐리게 쓴다.
function SymptomRow({
  e,
  n,
  interval,
  together,
  lead,
  onEdit,
}: {
  e: PregnancyEvent;
  n: number;
  interval: number | null;
  together: boolean;
  lead: boolean;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const d = durationSec(e);
  return (
    <button
      type="button"
      className={`pg-tl-row ${e.kind}${lead ? "" : " follow"}`}
      onClick={() => onEdit(e)}
    >
      <span className="pg-tl-l">
        <b>{hm(e.started_at)}</b>
        <small>
          {d !== null ? `${clock(d)} 지속` : ""} <Bolts n={e.intensity} />
        </small>
      </span>
      <span className="pg-tl-c">
        <span>{n}</span>
      </span>
      <span className="pg-tl-r">
        <em className={`pg-tl-kind ${e.kind}`}>
          {kindLabel[e.kind]}
          {together && " · 함께"}
        </em>
        {!lead ? (
          "같은 증상"
        ) : interval ? (
          <b className={interval < 600 ? "short" : ""}>{gap(interval)} 간격</b>
        ) : (
          "새 구간"
        )}
      </span>
    </button>
  );
}

function TimedRow({
  e,
  n,
  interval,
  onEdit,
}: {
  e: PregnancyEvent;
  n: number;
  interval: number | null;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const d = durationSec(e);
  return (
    <button
      type="button"
      className={`pg-tl-row ${e.kind}`}
      onClick={() => onEdit(e)}
    >
      <span className="pg-tl-l">
        <b>{hm(e.started_at)}</b>
        <small>
          {d !== null ? `${clock(d)} 지속` : ""} <Bolts n={e.intensity} />
        </small>
      </span>
      <span className="pg-tl-c">
        <span>{n}</span>
      </span>
      <span className="pg-tl-r">
        {interval ? (
          <>
            <b className={interval < 600 ? "short" : ""}>{gap(interval)}</b>
            이전 시작부터
          </>
        ) : (
          <>
            <b>—</b>새 구간
          </>
        )}
      </span>
    </button>
  );
}

// 합친 보기의 시간대별 증상 횟수. 증상이 시작한 시각으로 센다.
function SymptomHistogram({
  events,
  now,
}: {
  events: PregnancyEvent[];
  now: number;
}) {
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  const counts = Array<number>(24).fill(0);
  for (const ep of symptomEpisodes(events))
    if (ep.start >= d0.getTime()) counts[new Date(ep.start).getHours()]++;
  const max = Math.max(WATCH_PER_HOUR + 1, ...counts),
    W = 340,
    H = 80,
    L = 20,
    bw = (W - L) / 24;
  const y = (v: number) => H - (v / max) * (H - 12);
  return (
    <svg
      className="pg-hist"
      viewBox={`0 0 ${W} ${H + 18}`}
      role="img"
      aria-label="오늘 시간대별 증상(배뭉침·통증) 횟수"
    >
      <line x1={L} y1={H} x2={W} y2={H} stroke="var(--line)" />
      <line
        x1={L}
        y1={y(WATCH_PER_HOUR)}
        x2={W}
        y2={y(WATCH_PER_HOUR)}
        stroke="var(--pg-warn)"
        strokeDasharray="3 3"
      />
      <text
        x={L - 4}
        y={y(WATCH_PER_HOUR) + 3}
        fontSize={9.5}
        fill="var(--pg-warn)"
        textAnchor="end"
      >
        {WATCH_PER_HOUR}
      </text>
      {counts.map((c, h) => (
        <g key={h}>
          {c > 0 && (
            <>
              <rect
                x={L + h * bw + 1.5}
                y={y(c)}
                width={bw - 3}
                height={H - y(c)}
                rx={2}
                fill="var(--ink)"
                opacity={0.78}
              />
              <text
                x={L + h * bw + bw / 2}
                y={y(c) - 3}
                fontSize={9}
                fill="var(--muted)"
                textAnchor="middle"
              >
                {c}
              </text>
            </>
          )}
          {h % 6 === 0 && (
            <text
              x={L + h * bw}
              y={H + 13}
              fontSize={9.5}
              fill="var(--pg-faint)"
            >
              {h}시
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Timeline({
  events,
  kind,
  from,
  now,
  onEdit,
}: {
  events: PregnancyEvent[];
  kind: TimedKind;
  from: number;
  now: number;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const s = kindStats(events, kind, from);
  const numbered = new Map(s.list.map((e, i) => [e.id, i + 1]));
  const rows = s.list.slice().reverse();
  const perDay = new Map<string, number>();
  for (const e of rows)
    perDay.set(
      dayKey(e.started_at),
      (perDay.get(dayKey(e.started_at)) ?? 0) + 1,
    );
  const items: React.ReactNode[] = [];
  rows.forEach((e, i) => {
    const day = dayKey(e.started_at);
    if (i === 0 || dayKey(rows[i - 1].started_at) !== day)
      items.push(
        <div className="pg-day" key={`d-${day}`}>
          <span>{dayLabel(e.started_at)}</span>
          <span>{perDay.get(day)}회</span>
        </div>,
      );
    items.push(
      <TimedRow
        key={e.id}
        e={e}
        n={numbered.get(e.id) ?? 0}
        interval={e.interval}
        onEdit={onEdit}
      />,
    );
    const next = rows[i + 1];
    if (e.breakBefore && next && dayKey(next.started_at) === day)
      items.push(
        <div className="pg-gap" key={`g-${e.id}`}>
          {SESSION_GAP_MIN}분 넘게 쉼 · 여기서 간격을 새로 셉니다
        </div>,
      );
  });
  return (
    <>
      <div className="pg-sum3">
        <div>
          <small>횟수</small>
          <b>{s.count}회</b>
        </div>
        <div>
          <small>평균 지속</small>
          <b>{s.avgDuration ? clock(s.avgDuration) : "—"}</b>
        </div>
        <div>
          <small>평균 간격</small>
          <b>{s.avgInterval ? gap(s.avgInterval) : "—"}</b>
        </div>
      </div>
      <section className="pg-card">
        <div className="pg-sec-title">
          오늘 시간대별 횟수<small>점선은 1시간 {WATCH_PER_HOUR}회 기준</small>
        </div>
        <Histogram events={events} kind={kind} now={now} />
      </section>
      <section className="pg-card pg-tl">
        {items.length ? (
          items
        ) : (
          <p className="pg-empty">이 기간에 기록이 없습니다.</p>
        )}
      </section>
    </>
  );
}

function Histogram({
  events,
  kind,
  now,
}: {
  events: PregnancyEvent[];
  kind: TimedKind;
  now: number;
}) {
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  const counts = Array<number>(24).fill(0);
  for (const e of events) {
    const s = new Date(e.started_at);
    if (e.kind === kind && s.getTime() >= d0.getTime()) counts[s.getHours()]++;
  }
  const max = Math.max(WATCH_PER_HOUR + 1, ...counts),
    W = 340,
    H = 80,
    L = 20,
    bw = (W - L) / 24;
  const y = (v: number) => H - (v / max) * (H - 12);
  return (
    <svg
      className="pg-hist"
      viewBox={`0 0 ${W} ${H + 18}`}
      role="img"
      aria-label={`오늘 시간대별 ${kindLabel[kind]} 횟수`}
    >
      <line x1={L} y1={H} x2={W} y2={H} stroke="var(--line)" />
      <line
        x1={L}
        y1={y(WATCH_PER_HOUR)}
        x2={W}
        y2={y(WATCH_PER_HOUR)}
        stroke="var(--pg-warn)"
        strokeDasharray="3 3"
      />
      <text
        x={L - 4}
        y={y(WATCH_PER_HOUR) + 3}
        fontSize={9.5}
        fill="var(--pg-warn)"
        textAnchor="end"
      >
        {WATCH_PER_HOUR}
      </text>
      {counts.map((c, h) => (
        <g key={h}>
          {c > 0 && (
            <>
              <rect
                x={L + h * bw + 1.5}
                y={y(c)}
                width={bw - 3}
                height={H - y(c)}
                rx={2}
                fill={kindColor(kind)}
              />
              <text
                x={L + h * bw + bw / 2}
                y={y(c) - 3}
                fontSize={9}
                fill="var(--muted)"
                textAnchor="middle"
              >
                {c}
              </text>
            </>
          )}
          {h % 6 === 0 && (
            <text
              x={L + h * bw}
              y={H + 13}
              fontSize={9.5}
              fill="var(--pg-faint)"
            >
              {h}시
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const photoSrc = (id: string, demo: boolean) =>
  demo ? "" : `/api/baby/pregnancy/photo/${id}`;

function BleedingList({
  events,
  revealed,
  demo,
  onReveal,
  onEdit,
}: {
  events: PregnancyEvent[];
  revealed: Record<string, boolean>;
  demo: boolean;
  onReveal: (id: string, ids: string[]) => void;
  onEdit: (e: PregnancyEvent) => void;
}) {
  const bleeding = events.filter((e) => e.bleeding !== "none");
  const photos = events.reduce((n, e) => n + e.photo_ids.length, 0);
  return (
    <>
      <div className="pg-sum3">
        <div>
          <small>확인</small>
          <b>{events.length}건</b>
        </div>
        <div>
          <small>출혈</small>
          <b>{bleeding.length}건</b>
        </div>
        <div>
          <small>사진</small>
          <b>{photos}장</b>
        </div>
      </div>
      <section className="pg-card">
        {events.length ? (
          events.map((e) => {
            const color = e.bleeding_color
              ? colorLabel[e.bleeding_color]
              : null;
            const open = revealed[e.id];
            return (
              <div className="pg-bl" key={e.id}>
                {e.photo_ids.length ? (
                  <button
                    type="button"
                    className={`pg-thumb${open ? " open" : ""}`}
                    onClick={() => onReveal(e.id, e.photo_ids)}
                    aria-label={open ? "사진 크게 보기" : "흐린 사진 보기"}
                  >
                    {!demo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoSrc(e.photo_ids[0], demo)}
                        alt="출혈 사진"
                      />
                    )}
                    {!open && <span>탭해서 보기</span>}
                    {e.photo_ids.length > 1 && (
                      <em>+{e.photo_ids.length - 1}</em>
                    )}
                  </button>
                ) : (
                  <span
                    className={`pg-thumb empty${e.bleeding === "none" ? " none" : ""}`}
                  >
                    <Droplet size={20} />
                  </span>
                )}
                <button
                  type="button"
                  className="pg-bl-info"
                  onClick={() => onEdit(e)}
                >
                  <b>
                    {dayLabel(e.started_at)} {hm(e.started_at)}
                  </b>
                  <span className="pg-chips">
                    {e.bleeding && (
                      <span
                        className={`pg-chip${e.bleeding === "none" ? " none" : ""}`}
                      >
                        {bleedingLabel[e.bleeding]}
                      </span>
                    )}
                    {color && (
                      <span className="pg-chip">
                        <i style={{ background: color.hex }} />
                        {color.label}
                      </span>
                    )}
                    {e.created_by_name && (
                      <span className="pg-chip">{e.created_by_name}</span>
                    )}
                  </span>
                  {e.memo && <span className="pg-bl-memo">{e.memo}</span>}
                </button>
              </div>
            );
          })
        ) : (
          <p className="pg-empty">이 기간에 출혈 기록이 없습니다.</p>
        )}
      </section>
    </>
  );
}

function SheetFrame({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="pg-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-sheet-title"
    >
      <div className="pg-grab" />
      <h2 id="pg-sheet-title">{title}</h2>
      {sub && <p className="pg-sheet-sub">{sub}</p>}
      {children}
    </div>
  );
}

function Options<T extends string>({
  label,
  values,
  value,
  onChange,
  render,
  allowEmpty = true,
}: {
  label: string;
  values: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  render: (v: T) => React.ReactNode;
  allowEmpty?: boolean;
}) {
  return (
    <div className="pg-field">
      <span className="pg-label">{label}</span>
      <div className="pg-opts" role="group" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(value === v && allowEmpty ? null : v)}
          >
            {render(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
const intensityValues = ["1", "2", "3"] as const;

function StopSheet({
  sheet,
  onDone,
  onDelete,
}: {
  sheet: Extract<Sheet, { type: "stop" }>;
  onDone: (intensity: number | null, memo: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [intensity, setIntensity] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const d =
    (new Date(sheet.ended_at).getTime() -
      new Date(sheet.started_at).getTime()) /
    1000;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <SheetFrame
      title={`${kindLabel[sheet.kind]} ${clock(d)} 저장됨`}
      sub={`${hm(sheet.started_at)} – ${hm(sheet.ended_at)} · 아래는 선택 입력입니다`}
    >
      <Options
        label="강도"
        values={intensityValues}
        value={intensity as (typeof intensityValues)[number] | null}
        onChange={setIntensity}
        render={(v) => intensityLabel[Number(v) - 1]}
      />
      <div className="pg-field">
        <label htmlFor="pg-stop-memo">메모</label>
        <textarea
          id="pg-stop-memo"
          maxLength={500}
          value={memo}
          placeholder="예: 화장실 다녀온 뒤, 허리 쪽 묵직함"
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      <div className="pg-actions">
        <button
          type="button"
          className="pg-btn ghost"
          disabled={busy}
          onClick={() => run(onDelete)}
        >
          삭제
        </button>
        <button
          type="button"
          className="pg-btn primary"
          disabled={busy}
          onClick={() =>
            run(() => onDone(intensity ? Number(intensity) : null, memo.trim()))
          }
        >
          완료
        </button>
      </div>
    </SheetFrame>
  );
}

function TimedSheet({
  sheet,
  onSave,
  onDelete,
  onClose,
}: {
  sheet: Extract<Sheet, { type: "timed" }>;
  onSave: (v: {
    kind: TimedKind;
    started_at: string;
    ended_at: string;
    intensity: number | null;
    memo: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<TimedKind>(sheet.kind);
  const [start, setStart] = useState(toLocalInput(sheet.started_at));
  const [end, setEnd] = useState(toLocalInput(sheet.ended_at));
  const [intensity, setIntensity] = useState<string | null>(
    sheet.event?.intensity ? String(sheet.event.intensity) : null,
  );
  const [memo, setMemo] = useState(sheet.event?.memo ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !sheet.event;
  async function submit() {
    const s = fromLocalInput(start),
      e = fromLocalInput(end);
    if (!s || !e) return setError("시작과 종료 시각을 입력해주세요.");
    if (new Date(e) <= new Date(s))
      return setError("종료는 시작보다 늦어야 합니다.");
    if (new Date(e).getTime() - new Date(s).getTime() > MAX_DURATION_MIN * MIN)
      return setError(
        `한 번의 기록은 ${MAX_DURATION_MIN}분을 넘을 수 없습니다.`,
      );
    setBusy(true);
    setError("");
    try {
      await onSave({
        kind,
        started_at: s,
        ended_at: e,
        intensity: intensity ? Number(intensity) : null,
        memo: memo.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SheetFrame
      title={isNew ? "직접 입력" : `${kindLabel[sheet.kind]} 수정`}
      sub={
        sheet.note ??
        (isNew
          ? "실시간으로 누르지 못한 기록을 추가합니다."
          : `기록한 사람: ${sheet.event!.created_by_name || "구성원"}`)
      }
    >
      <Options
        label="타입"
        values={timedKinds}
        value={kind}
        allowEmpty={false}
        onChange={(v) => v && setKind(v)}
        render={(v) => kindLabel[v]}
      />
      <div className="pg-field-row">
        <div className="pg-field">
          <label htmlFor="pg-start">시작</label>
          <input
            id="pg-start"
            type="datetime-local"
            step={1}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="pg-field">
          <label htmlFor="pg-end">종료</label>
          <input
            id="pg-end"
            type="datetime-local"
            step={1}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      <Options
        label="강도 (선택)"
        values={intensityValues}
        value={intensity as (typeof intensityValues)[number] | null}
        onChange={setIntensity}
        render={(v) => intensityLabel[Number(v) - 1]}
      />
      <div className="pg-field">
        <label htmlFor="pg-memo">메모</label>
        <textarea
          id="pg-memo"
          maxLength={500}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      {error && (
        <p className="pg-error" role="alert">
          {error}
        </p>
      )}
      <div className="pg-actions">
        {onDelete ? (
          <DeleteButton onDelete={onDelete} onError={setError} />
        ) : (
          <button
            type="button"
            className="pg-btn ghost muted"
            onClick={onClose}
          >
            닫기
          </button>
        )}
        <button
          type="button"
          className="pg-btn primary"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </SheetFrame>
  );
}

// 삭제는 한 번 더 눌러 확정한다.
function DeleteButton({
  onDelete,
  onError,
}: {
  onDelete: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="pg-btn ghost"
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try {
          await onDelete();
        } catch (e) {
          onError((e as Error).message);
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {armed ? "삭제 확인" : "삭제"}
    </button>
  );
}

function BleedingSheet({
  event,
  demo,
  onSaved,
  onDelete,
  onClose,
}: {
  event?: PregnancyEvent;
  demo: boolean;
  onSaved: (e: PregnancyEvent) => void;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [at, setAt] = useState(
    toLocalInput(event?.started_at ?? new Date().toISOString(), false),
  );
  const [amount, setAmount] = useState<BleedingAmount | null>(
    event?.bleeding ?? null,
  );
  const [color, setColor] = useState<BleedingColor | null>(
    event?.bleeding_color ?? null,
  );
  const [memo, setMemo] = useState(event?.memo ?? "");
  const [keep, setKeep] = useState<string[]>(event?.photo_ids ?? []);
  const [added, setAdded] = useState<{ url: string; data: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const room = MAX_PHOTOS - keep.length - added.length;
  useEffect(
    () => () => added.forEach((p) => URL.revokeObjectURL(p.url)),
    // 시트를 닫을 때만 미리보기 주소를 정리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    try {
      const list = [...files].slice(0, room);
      const next: { url: string; data: string }[] = [];
      for (const f of list)
        next.push({ url: URL.createObjectURL(f), data: await photoBase64(f) });
      setAdded((a) => [...a, ...next]);
    } catch (e) {
      setError((e as Error).message || "사진을 읽지 못했습니다.");
    }
  }
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    if (!amount) return setError("출혈 여부를 골라주세요.");
    const startedAt = fromLocalInput(at);
    if (!startedAt) return setError("시각을 입력해주세요.");
    setBusy(true);
    setError("");
    const fields = {
      kind: "bleeding",
      started_at: startedAt,
      ended_at: null,
      bleeding: amount,
      bleeding_color: amount === "none" ? null : color,
      memo: memo.trim(),
      photos: added.map((p) => p.data),
    };
    try {
      const r = event
        ? await post({
            action: "update",
            id: event.id,
            expected_version: event.version,
            keep_photo_ids: keep,
            ...fields,
          })
        : await post({ action: "create", request_key: requestKey, ...fields });
      onSaved(r.event);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <SheetFrame
      title={event ? "출혈 수정" : "출혈 기록"}
      sub="확인한 시각을 남깁니다. 출혈이 없었다면 “출혈 없음”을 고르세요."
    >
      <p className="pg-alert">
        선홍색 출혈이나 양이 많을 때, 물 같은 분비물이 흐를 때는 기록보다 병원
        연락이 먼저입니다.
      </p>
      <div className="pg-field">
        <label htmlFor="pg-bleed-at">시각</label>
        <input
          id="pg-bleed-at"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </div>
      <Options
        label="출혈"
        values={bleedingAmounts}
        value={amount}
        allowEmpty={false}
        onChange={setAmount}
        render={(v) => bleedingLabel[v]}
      />
      {amount && amount !== "none" && (
        <Options
          label="색 (선택)"
          values={bleedingColors}
          value={color}
          onChange={setColor}
          render={(v) => (
            <>
              <i
                className="pg-swatch"
                style={{ background: colorLabel[v].hex }}
              />
              {colorLabel[v].label}
            </>
          )}
        />
      )}
      <div className="pg-field">
        <span className="pg-label">사진 (최대 {MAX_PHOTOS}장)</span>
        <div className="pg-photos">
          {keep.map((id) => (
            <button
              key={id}
              type="button"
              className="pg-photo"
              aria-label="이 사진 빼기"
              onClick={() => setKeep((k) => k.filter((x) => x !== id))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(id, demo)} alt="" />
              <X size={14} />
            </button>
          ))}
          {added.map((p, i) => (
            <button
              key={p.url}
              type="button"
              className="pg-photo"
              aria-label="이 사진 빼기"
              onClick={() => {
                URL.revokeObjectURL(p.url);
                setAdded((a) => a.filter((_, j) => j !== i));
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
              <X size={14} />
            </button>
          ))}
          {room > 0 && (
            <label className="pg-photo add">
              <Camera size={20} />
              <span>추가</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="pg-field">
        <label htmlFor="pg-bleed-memo">메모</label>
        <textarea
          id="pg-bleed-memo"
          maxLength={500}
          value={memo}
          placeholder="예: 속옷에 묻어남, 배뭉침 뒤 확인"
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      {error && (
        <p className="pg-error" role="alert">
          {error}
        </p>
      )}
      <div className="pg-actions">
        {onDelete ? (
          <DeleteButton onDelete={onDelete} onError={setError} />
        ) : (
          <button
            type="button"
            className="pg-btn ghost muted"
            onClick={onClose}
          >
            닫기
          </button>
        )}
        <button
          type="button"
          className="pg-btn primary"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </SheetFrame>
  );
}

function SettingsSheet({
  data,
  demo,
  onSaved,
  onConflict,
  onClose,
}: {
  data: PregnancyData;
  demo: boolean;
  onSaved: (s: PregnancyData["settings"]) => void;
  onConflict: () => void;
  onClose: () => void;
}) {
  const [due, setDue] = useState(data.settings.due_date ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    setBusy(true);
    try {
      const r = await post({
        action: "settings",
        due_date: due || null,
        expected_version: data.settings.version,
      });
      onSaved(r.settings);
    } catch (e) {
      setError((e as Error).message);
      if ((e as RequestError).status === 409) onConflict();
      setBusy(false);
    }
  }
  return (
    <SheetFrame
      title="출산예정일"
      sub="주수를 표시하고 37주부터는 분만 진통 안내를 함께 보여줍니다. 같은 공간의 구성원 모두에게 적용됩니다."
    >
      <div className="pg-field">
        <label htmlFor="pg-due">출산예정일</label>
        <input
          id="pg-due"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      <p className="pg-note">
        기준은 고정입니다: 최근 1시간 {WATCH_PER_HOUR}회면 “잦아지는 중”, 20분{" "}
        {CALL_PER_20_MIN}회 또는 1시간 {CALL_PER_HOUR}회면 “병원 연락 권장”.
        간격은 이전 시작부터 이번 시작까지이며 {SESSION_GAP_MIN}분 넘게 쉬면
        새로 셉니다.
      </p>
      {error && (
        <p className="pg-error" role="alert">
          {error}
        </p>
      )}
      <div className="pg-actions">
        <button type="button" className="pg-btn ghost muted" onClick={onClose}>
          닫기
        </button>
        <button
          type="button"
          className="pg-btn primary"
          disabled={busy}
          onClick={submit}
        >
          저장
        </button>
      </div>
    </SheetFrame>
  );
}

function PhotoViewer({
  ids,
  index,
  demo,
  onIndex,
  onClose,
}: {
  ids: string[];
  index: number;
  demo: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="pg-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="출혈 사진"
    >
      <button
        type="button"
        className="pg-viewer-close"
        aria-label="닫기"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      {!demo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoSrc(ids[index], demo)} alt={`출혈 사진 ${index + 1}`} />
      )}
      {ids.length > 1 && (
        <div className="pg-viewer-nav">
          <button
            type="button"
            aria-label="이전 사진"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <ChevronLeft size={22} />
          </button>
          <span>
            {index + 1} / {ids.length}
          </span>
          <button
            type="button"
            aria-label="다음 사진"
            disabled={index === ids.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
