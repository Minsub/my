"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  Droplet,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Stethoscope,
  StickyNote,
  Weight,
  X,
  Zap,
} from "lucide-react";
import {
  amnioticLabel,
  amnioticLevels,
  BELLY_MAX_CM,
  BELLY_MIN_CM,
  bleedingAmounts,
  bleedingColors,
  bleedingLabel,
  bodyFacts,
  CALL_PER_20_MIN,
  CALL_PER_HOUR,
  CERVIX_MAX_CM,
  checkupFacts,
  colorLabel,
  durationSec,
  FETAL_HR_MAX,
  FETAL_HR_MIN,
  FETAL_WEIGHT_MAX_G,
  FETAL_WEIGHT_MIN_G,
  intensityLabel,
  isMeasure,
  kindLabel,
  kindStats,
  MAX_DURATION_MIN,
  memoLimit,
  photoLimit,
  pregnancyKinds,
  pregnancyLevel,
  pregnancyWeek,
  SESSION_GAP_MIN,
  symptomEpisodes,
  symptomStats,
  TERM_WEEKS,
  timedKinds,
  isTimed,
  trendMetrics,
  WATCH_PER_HOUR,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  withIntervals,
  type AmnioticFluid,
  type BleedingAmount,
  type BleedingColor,
  type PregnancyData,
  type PregnancyEvent,
  type PregnancyKind,
  type PregnancySettings,
  type TimedKind,
  type TrendMetric,
} from "@/lib/pregnancy";
import { demoPregnancy } from "@/lib/demo-pregnancy";
import { copyText } from "@/lib/clipboard";

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
type Tab = "now" | "type" | "trend";
// 추이 그래프의 기간.
type Period = "3m" | "6m" | "all";
// 타입별 보기에 나오는 타입. 산모 기록은 추이 탭에서 본다.
type TypeKind = Exclude<PregnancyKind, "body">;
const typeKinds = pregnancyKinds.filter((k): k is TypeKind => k !== "body");
// 타입별 보기의 선택. "both"는 배뭉침·통증을 한 타임라인에 모아 본다(출혈 제외).
type ViewKind = TypeKind | "both";
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
  | { type: "checkup"; event?: PregnancyEvent }
  // back: 닫으면 돌아갈 시트(추이의 날짜 상세에서 연 경우).
  | { type: "checkupDetail"; event: PregnancyEvent; back?: Sheet }
  | { type: "body"; event?: PregnancyEvent; back?: Sheet }
  // 추이에서 고른 날짜(YYYY-MM-DD, 기기 시간대)의 진료·검사와 산모 기록.
  | { type: "day"; day: string }
  | { type: "settings" }
  // back: 사진을 닫으면 돌아갈 시트(진료 상세에서 연 경우).
  | { type: "photos"; ids: string[]; index: number; back?: Sheet };

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
// 기기 시간대의 날짜. 추이 그래프의 점과 날짜 상세를 잇는 키다.
const localDay = (v: string | number) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayStart = (day: string) => new Date(`${day}T00:00:00`).getTime();
const weekText = (due: string | null, at: number) => {
  const w = pregnancyWeek(due, at);
  return w ? `${w.weeks}주 ${w.days}일` : "";
};
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
  ({
    tightening: "var(--pg-tight)",
    pain: "var(--pg-pain)",
    bleeding: "var(--pg-blood)",
    checkup: "var(--pg-visit)",
    body: "var(--pg-body)",
  })[k];

// 서버가 1000px로 줄이므로 같은 크기로 보낸다. 사진 10장이 요청 한도(4MB)에 들어가도록
// 장당 base64 34만 자를 넘으면 품질을 낮춰 다시 만든다.
const PHOTO_BASE64_MAX = 340000;
async function photoBase64(file: File) {
  if (file.size > 20000000) throw Error("20MB 이하의 사진을 선택해주세요.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("사진을 처리할 수 없습니다.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.72, 0.6, 0.48]) {
    const data = canvas.toDataURL("image/jpeg", quality).split(",")[1];
    if (data.length <= PHOTO_BASE64_MAX) return data;
  }
  throw Error("사진 용량이 큽니다. 다른 사진을 선택해주세요.");
}

// 진료·검사 상세의 복사 문구. 날짜 한 줄, 입력한 값, 빈 줄, 메모 순서.
const checkupCopyText = (e: PregnancyEvent) =>
  [
    `[${kindLabel.checkup}] ${dayLabel(e.started_at)} ${hm(e.started_at)}`,
    ...checkupFacts(e).map((f) => `${f.label}: ${f.value}`),
    ...(e.memo ? ["", e.memo] : []),
  ].join("\n");

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
  const [tab, setTab] = useState<Tab>(
    initialQuery.tab === "type" || initialQuery.tab === "trend"
      ? initialQuery.tab
      : "now",
  );
  const [kind, setKind] = useState<ViewKind>(
    typeKinds.includes(initialQuery.kind as TypeKind)
      ? (initialQuery.kind as TypeKind)
      : "both",
  );
  const [period, setPeriod] = useState<Period>(
    initialQuery.period === "3m" || initialQuery.period === "all"
      ? initialQuery.period
      : "6m",
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
            ["trend", "추이"],
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
          onCheckup={() => setSheet({ type: "checkup" })}
          onBody={() => setSheet({ type: "body" })}
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
      ) : tab === "trend" ? (
        <TrendView
          events={events}
          settings={data.settings}
          now={now}
          period={period}
          onPeriod={(p) => {
            setPeriod(p);
            setQuery("period", p, "6m");
          }}
          onDay={(day) => setSheet({ type: "day", day })}
          onBody={() => setSheet({ type: "body" })}
          onCheckup={() => setSheet({ type: "checkup" })}
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
          onPhotos={(ids) => setSheet({ type: "photos", ids, index: 0 })}
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
      {sheet?.type === "checkup" && (
        <CheckupSheet
          key={sheet.event?.id ?? "new"}
          event={sheet.event}
          demo={demo}
          onSaved={(e) => {
            upsert(e);
            setSheet({ type: "checkupDetail", event: e });
            inform(
              `${kindLabel.checkup} ${hm(e.started_at)} 저장${e.photo_ids.length ? ` · 사진 ${e.photo_ids.length}장` : ""}`,
            );
          }}
          onDelete={sheet.event ? () => removeEvent(sheet.event!) : undefined}
          onClose={() =>
            setSheet(
              sheet.event
                ? { type: "checkupDetail", event: sheet.event }
                : null,
            )
          }
        />
      )}
      {sheet?.type === "checkupDetail" && (
        <CheckupDetail
          key={sheet.event.id}
          event={sheet.event}
          demo={demo}
          onEdit={
            sheet.event.can_edit
              ? () => setSheet({ type: "checkup", event: sheet.event })
              : undefined
          }
          onPhoto={(index) =>
            setSheet({
              type: "photos",
              ids: sheet.event.photo_ids,
              index,
              back: sheet,
            })
          }
          onClose={() => setSheet(sheet.back ?? null)}
        />
      )}
      {sheet?.type === "body" && (
        <BodySheet
          key={sheet.event?.id ?? "new"}
          event={sheet.event}
          last={{
            weight:
              events.find((e) => e.kind === "body" && e.weight_kg !== null)
                ?.weight_kg ?? null,
            belly:
              events.find((e) => e.kind === "body" && e.belly_cm !== null)
                ?.belly_cm ?? null,
          }}
          demo={demo}
          onSaved={(e) => {
            upsert(e);
            setSheet(sheet.back ?? null);
            inform(
              `${kindLabel.body} ${bodyFacts(e)
                .map((f) => f.value)
                .join(" · ")} 저장`,
            );
          }}
          onDelete={
            sheet.event
              ? async () => {
                  await removeEvent(sheet.event!);
                  if (sheet.back) setSheet(sheet.back);
                }
              : undefined
          }
          onClose={() => setSheet(sheet.back ?? null)}
        />
      )}
      {sheet?.type === "day" && (
        <DayDetail
          day={sheet.day}
          events={events}
          dueDate={data.settings.due_date}
          demo={demo}
          onCheckup={(e) =>
            setSheet({ type: "checkupDetail", event: e, back: sheet })
          }
          onEditBody={(e) => setSheet({ type: "body", event: e, back: sheet })}
          onPhoto={(ids, index) =>
            setSheet({ type: "photos", ids, index, back: sheet })
          }
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
            inform("임신 정보를 저장했습니다.");
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
          onClose={() => setSheet(sheet.back ?? null)}
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
    // 진료·검사는 상세를 먼저 연다. 구성원 누구나 보고 복사할 수 있고 수정은 상세에서 한다.
    if (e.kind === "checkup") {
      setSheet({ type: "checkupDetail", event: e });
      return;
    }
    if (!e.can_edit) {
      inform(
        demo
          ? "둘러보기에서는 수정하지 않습니다."
          : "기록한 사람 또는 관리자만 수정할 수 있습니다.",
      );
      return;
    }
    if (e.kind === "bleeding") setSheet({ type: "bleeding", event: e });
    else if (e.kind === "body") setSheet({ type: "body", event: e });
    else if (isTimed(e.kind))
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
          임신 기록<span className="heading-dot">.</span>
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
            aria-label="출산예정일·임신 전 몸무게 설정"
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
  onCheckup,
  onBody,
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
  onCheckup: () => void;
  onBody: () => void;
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
          <button type="button" className="pg-quick-visit" onClick={onCheckup}>
            <Stethoscope size={18} />
            {kindLabel.checkup}
          </button>
          <button type="button" className="pg-quick-body" onClick={onBody}>
            <Weight size={18} />
            {kindLabel.body} 기록
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
            {typeKinds.map((k) => (
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
  const facts = e.kind === "checkup" ? checkupFacts(e).map((f) => f.value) : [];
  const body = e.kind === "body" ? bodyFacts(e).map((f) => f.value) : [];
  const sub = [e.created_by_name, ...facts, e.memo].filter(Boolean).join(" · ");
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
        {e.kind === "body" ? (
          <>
            <b>{body[0]}</b>
            {body[1] && <span>{body[1]}</span>}
          </>
        ) : e.kind === "checkup" ? (
          <>
            <b>상세</b>
            {e.photo_ids.length > 0 && <span>사진 {e.photo_ids.length}장</span>}
          </>
        ) : e.kind === "bleeding" ? (
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
    L = 52,
    R = 8,
    span = 180 * MIN;
  const x = (v: number) => L + ((v - (now - span)) / span) * (W - L - R);
  const lane: Record<TypeKind, number> = {
    tightening: 20,
    pain: 44,
    bleeding: 68,
    checkup: 92,
  };
  // 산모 기록은 진통 흐름과 관계없어 그리지 않는다.
  const bars = events.filter(
    (e) => e.kind !== "body" && new Date(e.started_at).getTime() >= now - span,
  );
  return (
    <svg
      className="pg-strip"
      viewBox={`0 0 ${W} 124`}
      role="img"
      aria-label="최근 3시간 동안의 기록 막대"
    >
      {[0, 1, 2, 3].map((h) => {
        const xt = x(now - span + h * 60 * MIN);
        return (
          <g key={h}>
            <line x1={xt} y1={8} x2={xt} y2={104} stroke="var(--line)" />
            <text
              x={xt}
              y={118}
              fontSize={10}
              fill="var(--pg-faint)"
              textAnchor={h === 0 ? "start" : h === 3 ? "end" : "middle"}
            >
              {h === 3 ? "지금" : hm(now - span + h * 60 * MIN)}
            </text>
          </g>
        );
      })}
      {typeKinds.map((k) => (
        <text key={k} x={0} y={lane[k] + 4} fontSize={10.5} fill="var(--muted)">
          {kindLabel[k]}
        </text>
      ))}
      {bars.map((e) => {
        const s = new Date(e.started_at).getTime();
        if (e.kind === "body") return null;
        if (e.kind === "checkup")
          return (
            <rect
              key={e.id}
              x={x(s) - 4.5}
              y={lane.checkup - 4.5}
              width={9}
              height={9}
              rx={2}
              fill="var(--pg-visit)"
            />
          );
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
  onPhotos,
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
  onPhotos: (ids: string[]) => void;
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
        {typeKinds.map((k) => (
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
      ) : kind === "checkup" ? (
        <CheckupList
          events={events.filter(
            (e) =>
              e.kind === "checkup" && new Date(e.started_at).getTime() >= from,
          )}
          demo={demo}
          onPhotos={onPhotos}
          onOpen={onEdit}
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

// 진료·검사 목록. 사진은 흐리게 가리지 않는다. 행을 누르면 상세(복사·수정)를 연다.
function CheckupList({
  events,
  demo,
  onPhotos,
  onOpen,
}: {
  events: PregnancyEvent[];
  demo: boolean;
  onPhotos: (ids: string[]) => void;
  onOpen: (e: PregnancyEvent) => void;
}) {
  const photos = events.reduce((n, e) => n + e.photo_ids.length, 0);
  const cervix = events.find((e) => e.cervix_length_cm !== null);
  return (
    <>
      <div className="pg-sum3">
        <div>
          <small>기록</small>
          <b>{events.length}건</b>
        </div>
        <div>
          <small>최근 경부길이</small>
          <b>{cervix ? `${cervix.cervix_length_cm}cm` : "—"}</b>
          {cervix && (
            <span className="pg-sum-sub">
              {dayLabel(cervix.started_at).replace(/ \(.\)$/, "")}
            </span>
          )}
        </div>
        <div>
          <small>사진</small>
          <b>{photos}장</b>
        </div>
      </div>
      <section className="pg-card">
        {events.length ? (
          events.map((e) => (
            <div className="pg-bl" key={e.id}>
              {e.photo_ids.length ? (
                <button
                  type="button"
                  className="pg-thumb open visit"
                  onClick={() => onPhotos(e.photo_ids)}
                  aria-label="사진 크게 보기"
                >
                  {!demo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc(e.photo_ids[0], demo)} alt="진료 사진" />
                  )}
                  {e.photo_ids.length > 1 && <em>+{e.photo_ids.length - 1}</em>}
                </button>
              ) : (
                <span className="pg-thumb empty visit">
                  <Stethoscope size={20} />
                </span>
              )}
              <button
                type="button"
                className="pg-bl-info"
                onClick={() => onOpen(e)}
              >
                <b>
                  {dayLabel(e.started_at)} {hm(e.started_at)}
                </b>
                <span className="pg-chips">
                  {checkupFacts(e).map((f) => (
                    <span className="pg-chip" key={f.label}>
                      {f.label} {f.value}
                    </span>
                  ))}
                  {e.created_by_name && (
                    <span className="pg-chip">{e.created_by_name}</span>
                  )}
                </span>
                {e.memo && <span className="pg-bl-memo clamp">{e.memo}</span>}
              </button>
            </div>
          ))
        ) : (
          <p className="pg-empty">
            이 기간에 {kindLabel.checkup} 기록이 없습니다.
          </p>
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const photos = usePhotoDraft(
    event?.photo_ids ?? [],
    photoLimit.bleeding,
    setError,
  );
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    if (photos.reading) return setError("사진을 준비하는 중입니다.");
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
      photos: photos.added.map((p) => p.data),
    };
    try {
      const r = event
        ? await post({
            action: "update",
            id: event.id,
            expected_version: event.version,
            keep_photo_ids: photos.keep,
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
      <PhotoField draft={photos} demo={demo} />
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

// 입력 칸의 숫자. 비우면 null, 잘못된 값이면 NaN.
const parseNumber = (v: string) => {
  const t = v.trim().replace(",", ".");
  return t ? Number(t) : null;
};
const inRange = (v: number, min: number, max: number) =>
  Number.isFinite(v) && v >= min && v <= max;

// 진료·NST 같은 병원 기록. 따로 둘 값은 모두 선택이고 나머지는 메모에 쓴다.
function CheckupSheet({
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
  const [cervix, setCervix] = useState(
    event?.cervix_length_cm != null ? String(event.cervix_length_cm) : "",
  );
  const [fluid, setFluid] = useState<AmnioticFluid | null>(
    event?.amniotic_fluid ?? null,
  );
  const [heart, setHeart] = useState(
    event?.fetal_heart_rate != null ? String(event.fetal_heart_rate) : "",
  );
  const [fetalWeight, setFetalWeight] = useState(
    event?.fetal_weight_g != null ? String(event.fetal_weight_g) : "",
  );
  const [memo, setMemo] = useState(event?.memo ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const photos = usePhotoDraft(
    event?.photo_ids ?? [],
    photoLimit.checkup,
    setError,
  );
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    if (photos.reading) return setError("사진을 준비하는 중입니다.");
    const startedAt = fromLocalInput(at);
    if (!startedAt) return setError("시각을 입력해주세요.");
    const cervixCm = parseNumber(cervix);
    if (
      cervixCm !== null &&
      !(Number.isFinite(cervixCm) && cervixCm > 0 && cervixCm <= CERVIX_MAX_CM)
    )
      return setError(
        `자궁경부길이는 cm로 0보다 크고 ${CERVIX_MAX_CM} 이하로 입력해주세요.`,
      );
    const bpm = parseNumber(heart);
    if (
      bpm !== null &&
      !(Number.isInteger(bpm) && bpm >= FETAL_HR_MIN && bpm <= FETAL_HR_MAX)
    )
      return setError(
        `아기 심박수는 ${FETAL_HR_MIN}~${FETAL_HR_MAX} 사이 정수로 입력해주세요.`,
      );
    const grams = parseNumber(fetalWeight);
    if (
      grams !== null &&
      !(
        Number.isInteger(grams) &&
        grams >= FETAL_WEIGHT_MIN_G &&
        grams <= FETAL_WEIGHT_MAX_G
      )
    )
      return setError(
        `아기 몸무게는 g 단위 정수(${FETAL_WEIGHT_MIN_G}~${FETAL_WEIGHT_MAX_G.toLocaleString("ko-KR")})로 입력해주세요.`,
      );
    setBusy(true);
    setError("");
    const fields = {
      kind: "checkup",
      started_at: startedAt,
      ended_at: null,
      cervix_length_cm: cervixCm,
      amniotic_fluid: fluid,
      fetal_heart_rate: bpm,
      fetal_weight_g: grams,
      memo: memo.trim(),
      photos: photos.added.map((p) => p.data),
    };
    try {
      const r = event
        ? await post({
            action: "update",
            id: event.id,
            expected_version: event.version,
            keep_photo_ids: photos.keep,
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
      title={event ? `${kindLabel.checkup} 수정` : `${kindLabel.checkup} 기록`}
      sub="진료나 NST 수축검사 같은 병원 기록입니다. 아래 값은 모두 선택이고 나머지는 메모에 적어주세요."
    >
      <div className="pg-field">
        <label htmlFor="pg-visit-at">시각</label>
        <input
          id="pg-visit-at"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </div>
      <div className="pg-field-row">
        <div className="pg-field">
          <label htmlFor="pg-cervix">자궁경부길이 (cm)</label>
          <input
            id="pg-cervix"
            type="text"
            inputMode="decimal"
            placeholder="예: 3.2"
            value={cervix}
            onChange={(e) => setCervix(e.target.value)}
          />
        </div>
        <div className="pg-field">
          <label htmlFor="pg-fhr">아기 심박수 (bpm)</label>
          <input
            id="pg-fhr"
            type="text"
            inputMode="numeric"
            placeholder="예: 145"
            value={heart}
            onChange={(e) => setHeart(e.target.value)}
          />
        </div>
      </div>
      <div className="pg-field">
        <label htmlFor="pg-fetal-weight">아기 몸무게 (g)</label>
        <input
          id="pg-fetal-weight"
          type="text"
          inputMode="numeric"
          placeholder="예: 1850"
          value={fetalWeight}
          onChange={(e) => setFetalWeight(e.target.value.replace(/,/g, ""))}
        />
      </div>
      <Options
        label="양수량"
        values={amnioticLevels}
        value={fluid}
        onChange={setFluid}
        render={(v) => amnioticLabel[v]}
      />
      <PhotoField draft={photos} demo={demo} />
      <div className="pg-field">
        <label htmlFor="pg-visit-memo">메모</label>
        <textarea
          id="pg-visit-memo"
          className="tall"
          maxLength={memoLimit("checkup")}
          value={memo}
          placeholder={
            "예: 정기 진료. NST 40분 · 규칙적인 수축 없음\n다음 진료 10월 4일"
          }
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

// 진료·검사 상세. 입력한 값과 메모를 보여주고 텍스트로 복사한다.
function CheckupDetail({
  event,
  demo,
  onEdit,
  onPhoto,
  onClose,
}: {
  event: PregnancyEvent;
  demo: boolean;
  onEdit?: () => void;
  onPhoto: (index: number) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const facts = checkupFacts(event);
  async function copy() {
    try {
      await copyText(checkupCopyText(event));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }
  return (
    <SheetFrame
      title={`${kindLabel.checkup} · ${dayLabel(event.started_at)} ${hm(event.started_at)}`}
      sub={`기록한 사람: ${event.created_by_name || "구성원"}`}
    >
      {facts.length > 0 && (
        <dl className="pg-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {event.memo ? (
        <p className="pg-visit-memo">{event.memo}</p>
      ) : (
        facts.length === 0 && (
          <p className="pg-empty">입력한 내용이 없습니다.</p>
        )
      )}
      {event.photo_ids.length > 0 && (
        <div className="pg-photos">
          {event.photo_ids.map((id, i) => (
            <button
              key={id}
              type="button"
              className="pg-photo view"
              aria-label={`사진 ${i + 1} 크게 보기`}
              onClick={() => onPhoto(i)}
            >
              {!demo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc(id, demo)} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
      {copied === "failed" && (
        <p className="pg-error" role="alert">
          복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.
        </p>
      )}
      <div className="pg-actions">
        {onEdit ? (
          <button type="button" className="pg-btn ghost" onClick={onEdit}>
            수정
          </button>
        ) : (
          <button
            type="button"
            className="pg-btn ghost muted"
            onClick={onClose}
          >
            닫기
          </button>
        )}
        <button type="button" className="pg-btn primary" onClick={copy}>
          {copied === "done" ? (
            <>
              <Check size={16} /> 복사됨
            </>
          ) : (
            <>
              <Copy size={16} /> 복사하기
            </>
          )}
        </button>
      </div>
    </SheetFrame>
  );
}

type PhotoDraft = ReturnType<typeof usePhotoDraft>;
// 출혈·진료 시트의 사진 입력. 남길 기존 사진 id와 새로 고른 사진을 따로 들고 있다.
function usePhotoDraft(
  initial: string[],
  limit: number,
  onError: (message: string) => void,
) {
  const [keep, setKeep] = useState<string[]>(initial);
  const [added, setAdded] = useState<{ url: string; data: string }[]>([]);
  const [reading, setReading] = useState(false);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const list = urls.current;
    // 시트를 닫을 때 미리보기 주소를 정리한다.
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const room = limit - keep.length - added.length;
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    onError("");
    setReading(true);
    try {
      for (const f of [...files].slice(0, room)) {
        const data = await photoBase64(f);
        const url = URL.createObjectURL(f);
        urls.current.push(url);
        setAdded((a) => [...a, { url, data }]);
      }
    } catch (e) {
      onError((e as Error).message || "사진을 읽지 못했습니다.");
    } finally {
      setReading(false);
    }
  }
  return {
    keep,
    added,
    room,
    limit,
    reading,
    addFiles,
    removeKept: (id: string) => setKeep((k) => k.filter((x) => x !== id)),
    removeAdded: (url: string) =>
      setAdded((a) => a.filter((p) => p.url !== url)),
  };
}

function PhotoField({ draft, demo }: { draft: PhotoDraft; demo: boolean }) {
  return (
    <div className="pg-field">
      <span className="pg-label">
        사진 (선택 · 최대 {draft.limit}장
        {draft.keep.length + draft.added.length
          ? ` · ${draft.keep.length + draft.added.length}장`
          : ""}
        )
      </span>
      <div className="pg-photos">
        {draft.keep.map((id) => (
          <button
            key={id}
            type="button"
            className="pg-photo"
            aria-label="이 사진 빼기"
            onClick={() => draft.removeKept(id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(id, demo)} alt="" />
            <X size={14} />
          </button>
        ))}
        {draft.added.map((p) => (
          <button
            key={p.url}
            type="button"
            className="pg-photo"
            aria-label="이 사진 빼기"
            onClick={() => draft.removeAdded(p.url)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" />
            <X size={14} />
          </button>
        ))}
        {draft.reading && (
          <span className="pg-photo add" aria-live="polite">
            <span>준비 중</span>
          </span>
        )}
        {draft.room > 0 && !draft.reading && (
          <label className="pg-photo add">
            <Camera size={20} />
            <span>추가</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                draft.addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
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
  const [weight, setWeight] = useState(
    data.settings.pre_weight_kg != null
      ? String(data.settings.pre_weight_kg)
      : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    const kg = parseNumber(weight);
    if (kg !== null && !inRange(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG))
      return setError(
        `임신 전 몸무게는 ${WEIGHT_MIN_KG}~${WEIGHT_MAX_KG}kg 사이로 입력해주세요.`,
      );
    setBusy(true);
    try {
      const r = await post({
        action: "settings",
        due_date: due || null,
        pre_weight_kg: kg,
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
      title="임신 정보"
      sub="출산예정일로 주수를 표시하고 37주부터는 분만 진통 안내를 함께 보여줍니다. 임신 전 몸무게는 몸무게 추이의 기준선이 됩니다. 같은 공간의 구성원 모두에게 적용됩니다."
    >
      <div className="pg-field-row">
        <div className="pg-field">
          <label htmlFor="pg-due">출산예정일</label>
          <input
            id="pg-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="pg-field">
          <label htmlFor="pg-pre-weight">임신 전 몸무게 (kg)</label>
          <input
            id="pg-pre-weight"
            type="text"
            inputMode="decimal"
            placeholder="예: 55.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
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
      aria-label="사진"
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
        <img src={photoSrc(ids[index], demo)} alt={`사진 ${index + 1}`} />
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

// 산모 기록. 몸무게·배둘레 중 하나만 재도 저장한다. 사진은 없다.
function BodySheet({
  event,
  last,
  demo,
  onSaved,
  onDelete,
  onClose,
}: {
  event?: PregnancyEvent;
  last: { weight: number | null; belly: number | null };
  demo: boolean;
  onSaved: (e: PregnancyEvent) => void;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [at, setAt] = useState(
    toLocalInput(event?.started_at ?? new Date().toISOString(), false),
  );
  const [weight, setWeight] = useState(
    event?.weight_kg != null ? String(event.weight_kg) : "",
  );
  const [belly, setBelly] = useState(
    event?.belly_cm != null ? String(event.belly_cm) : "",
  );
  const [memo, setMemo] = useState(event?.memo ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  async function submit() {
    if (demo) return setError("둘러보기에서는 저장하지 않습니다.");
    const startedAt = fromLocalInput(at);
    if (!startedAt) return setError("시각을 입력해주세요.");
    const kg = parseNumber(weight),
      cm = parseNumber(belly);
    if (kg === null && cm === null)
      return setError("몸무게나 배둘레를 입력해주세요.");
    if (kg !== null && !inRange(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG))
      return setError(
        `몸무게는 ${WEIGHT_MIN_KG}~${WEIGHT_MAX_KG}kg 사이로 입력해주세요.`,
      );
    if (cm !== null && !inRange(cm, BELLY_MIN_CM, BELLY_MAX_CM))
      return setError(
        `배둘레는 ${BELLY_MIN_CM}~${BELLY_MAX_CM}cm 사이로 입력해주세요.`,
      );
    setBusy(true);
    setError("");
    const fields = {
      kind: "body",
      started_at: startedAt,
      ended_at: null,
      weight_kg: kg,
      belly_cm: cm,
      memo: memo.trim(),
    };
    try {
      const r = event
        ? await post({
            action: "update",
            id: event.id,
            expected_version: event.version,
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
      title={event ? `${kindLabel.body} 기록 수정` : `${kindLabel.body} 기록`}
      sub={
        event
          ? `기록한 사람: ${event.created_by_name || "구성원"}`
          : "몸무게와 배둘레 중 잰 것만 입력하세요. 소수 한 자리까지 저장합니다."
      }
    >
      <div className="pg-field">
        <label htmlFor="pg-body-at">시각</label>
        <input
          id="pg-body-at"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </div>
      <div className="pg-field-row">
        <div className="pg-field">
          <label htmlFor="pg-weight">몸무게 (kg)</label>
          <input
            id="pg-weight"
            type="text"
            inputMode="decimal"
            placeholder={
              last.weight !== null ? `지난번 ${last.weight}` : "예: 62.4"
            }
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="pg-field">
          <label htmlFor="pg-belly">배둘레 (cm)</label>
          <input
            id="pg-belly"
            type="text"
            inputMode="decimal"
            placeholder={
              last.belly !== null ? `지난번 ${last.belly}` : "예: 92.5"
            }
            value={belly}
            onChange={(e) => setBelly(e.target.value)}
          />
        </div>
      </div>
      <div className="pg-field">
        <label htmlFor="pg-body-memo">메모</label>
        <textarea
          id="pg-body-memo"
          maxLength={memoLimit("body")}
          value={memo}
          placeholder="예: 아침 공복, 병원 체중계"
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

const DAY = 86400000;
const periodDays: Record<Period, number | null> = {
  "3m": 91,
  "6m": 183,
  all: null,
};
// pregnancy.css의 --pg-body·--pg-visit와 같은 값. 캔버스는 CSS 변수를 읽지 못한다.
const metricColor = { body: "#2f7d6d", checkup: "#3d6f8e" } as const;
const CHART_INK = "#7d8577";
const CHART_GRID = "#eef0ea";
const metricNumber = (m: TrendMetric, v: number) =>
  v.toLocaleString("ko-KR", { maximumFractionDigits: m.digits });
const metricValue = (m: TrendMetric, v: number) =>
  `${metricNumber(m, v)}${m.unit}`;
const metricChange = (m: TrendMetric, d: number) =>
  `${d > 0 ? "+" : d < 0 ? "−" : "±"}${metricNumber(m, Math.abs(d))}${m.unit}`;
type TrendPoint = { t: number; v: number; day: string };
type AxisTick = { value: number; label: string | string[] };

// 가로축 눈금. 출산예정일이 있으면 임신 주 시작일에 맞춰 "24주"와 날짜를 함께 쓴다.
function axisTicks(xMin: number, xMax: number, due: string | null) {
  const span = (xMax - xMin) / DAY;
  const step = (span <= 50 ? 7 : span <= 120 ? 14 : span <= 250 ? 28 : 56) * DAY;
  // 예정일이 없으면 월요일(2024-01-01)에 맞춘다.
  const anchor = due ? dayStart(due) - 280 * DAY : dayStart("2024-01-01");
  const ticks: AxisTick[] = [];
  for (
    let t = anchor + Math.ceil((xMin - anchor) / step) * step;
    t <= xMax;
    t += step
  ) {
    const d = new Date(t);
    const date = `${d.getMonth() + 1}/${d.getDate()}`;
    const w = Math.round((t - anchor) / DAY / 7);
    ticks.push({
      value: t,
      label: due && w >= 0 && w <= 44 ? [`${w}주`, date] : date,
    });
  }
  return ticks;
}

// 몸무게·배둘레·자궁경부길이·아기 심박수를 항목마다 하나의 그래프로 본다.
// 네 그래프는 같은 가로축 범위를 써서 위아래로 날짜가 맞는다.
function TrendView({
  events,
  settings,
  now,
  period,
  onPeriod,
  onDay,
  onBody,
  onCheckup,
}: {
  events: PregnancyEvent[];
  settings: PregnancySettings;
  now: number;
  period: Period;
  onPeriod: (p: Period) => void;
  onDay: (day: string) => void;
  onBody: () => void;
  onCheckup: () => void;
}) {
  // 하루 안에서는 축이 바뀌지 않게 오늘 0시를 기준으로 잡는다.
  const today = dayStart(localDay(now));
  const days = periodDays[period];
  const from = days === null ? 0 : today - days * DAY;
  const measures = events.filter(
    (e) => isMeasure(e.kind) && new Date(e.started_at).getTime() >= from,
  );
  const series = trendMetrics.map((metric) => ({
    metric,
    points: measures
      .filter((e) => e.kind === metric.kind && e[metric.key] !== null)
      .map((e) => ({
        t: new Date(e.started_at).getTime(),
        v: e[metric.key] as number,
        day: localDay(e.started_at),
      }))
      .sort((a, b) => a.t - b.t),
  }));
  const times = series.flatMap((s) => s.points.map((p) => p.t));
  const xMax = today + 2 * DAY;
  const xMin = Math.min(
    times.length ? dayStart(localDay(Math.min(...times))) - 2 * DAY : from,
    today - 14 * DAY,
  );
  const ticks = axisTicks(xMin, xMax, settings.due_date);
  const byDay = new Map<string, PregnancyEvent[]>();
  for (const e of measures) {
    const d = localDay(e.started_at);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const dayList = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <div className="pg-trend">
      <div className="pg-trend-bar">
        <div className="pg-range" role="group" aria-label="기간">
          {(
            [
              ["3m", "3개월"],
              ["6m", "6개월"],
              ["all", "전체"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => onPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="pg-add body" onClick={onBody}>
          <Plus size={15} />
          {kindLabel.body} 기록
        </button>
      </div>
      <div className="pg-trend-grid">
        {series.map(({ metric, points }) => (
          <TrendCard
            key={metric.key}
            metric={metric}
            points={points}
            base={metric.key === "weight_kg" ? settings.pre_weight_kg : null}
            xMin={xMin}
            xMax={xMax}
            ticks={ticks}
            onDay={onDay}
            onAdd={metric.kind === "body" ? onBody : onCheckup}
          />
        ))}
      </div>
      <section className="pg-card">
        <div className="pg-sec-title">
          날짜별 기록<small>누르면 메모·사진까지 보기</small>
        </div>
        {dayList.length ? (
          <div className="pg-rows">
            {dayList.map(([day, list]) => {
              const facts = list.flatMap((e) =>
                e.kind === "body" ? bodyFacts(e) : checkupFacts(e),
              );
              const memos = list.filter((e) => e.memo).length;
              const photos = list.reduce((n, e) => n + e.photo_ids.length, 0);
              return (
                <button
                  key={day}
                  type="button"
                  className="pg-dl"
                  onClick={() => onDay(day)}
                >
                  <span className="pg-dl-date">
                    <b>{dayLabel(`${day}T00:00:00`)}</b>
                    <small>
                      {[
                        weekText(settings.due_date, dayStart(day)),
                        ...new Set(list.map((e) => kindLabel[e.kind])),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="pg-chips">
                    {facts.length ? (
                      facts.map((f, i) => (
                        <span className="pg-chip" key={`${f.label}-${i}`}>
                          {f.label} {f.value}
                        </span>
                      ))
                    ) : (
                      <span className="pg-chip">메모만</span>
                    )}
                  </span>
                  <span className="pg-dl-meta">
                    {memos > 0 && (
                      <StickyNote size={14} aria-label={`메모 ${memos}건`} />
                    )}
                    {photos > 0 && <span>사진 {photos}</span>}
                    <ChevronRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="pg-empty">
            이 기간에 {kindLabel.checkup}·{kindLabel.body} 기록이 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}

function TrendCard({
  metric,
  points,
  base,
  xMin,
  xMax,
  ticks,
  onDay,
  onAdd,
}: {
  metric: TrendMetric;
  points: TrendPoint[];
  base: number | null;
  xMin: number;
  xMax: number;
  ticks: AxisTick[];
  onDay: (day: string) => void;
  onAdd: () => void;
}) {
  const first = points[0],
    last = points[points.length - 1];
  const sub = last
    ? [
        base !== null ? `임신 전보다 ${metricChange(metric, last.v - base)}` : "",
        points.length > 1
          ? `기간 첫 기록보다 ${metricChange(metric, last.v - first.v)}`
          : "",
        `${points.length}회`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <section className="pg-card pg-trend-card">
      <div className="pg-trend-head">
        <span>
          <i className={`pg-dot ${metric.kind}`} />
          {metric.label}
        </span>
        {last && (
          <button
            type="button"
            className="pg-trend-last"
            onClick={() => onDay(last.day)}
          >
            {metricValue(metric, last.v)}
            <small>{last.day.slice(5).replace("-", "/")}</small>
          </button>
        )}
      </div>
      {sub && <p className="pg-trend-sub">{sub}</p>}
      {points.length ? (
        <TrendChart
          metric={metric}
          points={points}
          base={base}
          xMin={xMin}
          xMax={xMax}
          ticks={ticks}
          onDay={onDay}
        />
      ) : (
        <div className="pg-trend-empty">
          <span>이 기간에 기록이 없습니다.</span>
          <button type="button" onClick={onAdd}>
            {metric.kind === "body"
              ? `${kindLabel.body} 기록 추가`
              : `${kindLabel.checkup}에서 입력`}
          </button>
        </div>
      )}
    </section>
  );
}

function TrendChart({
  metric,
  points,
  base,
  xMin,
  xMax,
  ticks,
  onDay,
}: {
  metric: TrendMetric;
  points: TrendPoint[];
  base: number | null;
  xMin: number;
  xMax: number;
  ticks: AxisTick[];
  onDay: (day: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onDayRef = useRef(onDay);
  useEffect(() => {
    onDayRef.current = onDay;
  });
  // 부모가 다시 그려질 때마다 배열이 새로 만들어지므로 내용이 바뀔 때만 차트를 다시 만든다.
  const input = JSON.stringify({ points, base, xMin, xMax, ticks });
  useEffect(() => {
    if (!ref.current) return;
    const v = JSON.parse(input) as {
      points: TrendPoint[];
      base: number | null;
      xMin: number;
      xMax: number;
      ticks: AxisTick[];
    };
    const color = metricColor[metric.kind];
    const labels = new Map(v.ticks.map((t) => [t.value, t.label]));
    const lines = [
      ...(metric.line ? [metric.line] : []),
      ...(v.base !== null
        ? [{ value: v.base, label: `임신 전 ${v.base}kg` }]
        : []),
    ];
    const refValues = [
      ...lines.map((l) => l.value),
      ...(metric.band ? [metric.band.from, metric.band.to] : []),
    ];
    // 참고 범위(띠)와 기준선(점선). 진단 기준이 아니라 비교용이다.
    const references = {
      id: "pgReferences",
      beforeDatasetsDraw(chart: Chart) {
        const { ctx, chartArea: a } = chart;
        const y = chart.scales.y;
        ctx.save();
        ctx.font = "10px system-ui, sans-serif";
        // 이름표는 오른쪽 끝에 둔다. 왼쪽은 첫 기록 점과 겹치기 쉽다.
        ctx.textAlign = "right";
        if (metric.band) {
          const top = Math.max(a.top, y.getPixelForValue(metric.band.to));
          const bottom = Math.min(
            a.bottom,
            y.getPixelForValue(metric.band.from),
          );
          if (bottom > top) {
            ctx.fillStyle = color + "14";
            ctx.fillRect(a.left, top, a.right - a.left, bottom - top);
            ctx.fillStyle = CHART_INK;
            ctx.fillText(metric.band.label, a.right - 4, top + 11);
          }
        }
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#b5bbae";
        for (const l of lines) {
          const py = y.getPixelForValue(l.value);
          if (py < a.top || py > a.bottom) continue;
          ctx.beginPath();
          ctx.moveTo(a.left, py);
          ctx.lineTo(a.right, py);
          ctx.stroke();
          ctx.fillStyle = CHART_INK;
          ctx.fillText(l.label, a.right - 4, py - 4);
        }
        ctx.restore();
      },
    };
    const many = v.points.length > 40;
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        datasets: [
          {
            data: v.points.map((p) => ({ x: p.t, y: p.v })),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: many ? 2 : 3.5,
            pointHoverRadius: 6,
            pointHitRadius: 12,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // 점을 정확히 누르지 않아도 가장 가까운 날짜를 고른다.
        interaction: { mode: "nearest", axis: "x", intersect: false },
        onClick: (_, hits) => {
          const hit = hits[0];
          if (hit) onDayRef.current(v.points[hit.index].day);
        },
        onHover: (event, hits) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = hits.length ? "pointer" : "";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => {
                const d = new Date(v.points[items[0].dataIndex].t);
                return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm(d.getTime())}`;
              },
              label: (ctx) => metricValue(metric, ctx.parsed.y ?? 0),
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            min: v.xMin,
            max: v.xMax,
            grid: { color: CHART_GRID },
            border: { display: false },
            afterBuildTicks: (axis) => {
              axis.ticks = v.ticks.map((t) => ({ value: t.value }));
            },
            ticks: {
              maxRotation: 0,
              autoSkipPadding: 10,
              color: CHART_INK,
              font: { size: 10 },
              callback: (value) => labels.get(Number(value)) ?? "",
            },
          },
          y: {
            grace: "12%",
            min: metric.zero ? 0 : undefined,
            suggestedMin: refValues.length ? Math.min(...refValues) : undefined,
            suggestedMax: refValues.length ? Math.max(...refValues) : undefined,
            grid: { color: CHART_GRID },
            border: { display: false },
            ticks: { maxTicksLimit: 5, color: CHART_INK, font: { size: 10 } },
          },
        },
      },
      plugins: [references],
    });
    return () => chart.destroy();
  }, [input, metric]);
  return (
    <div className="pg-trend-chart">
      <canvas
        ref={ref}
        role="img"
        aria-label={`${metric.label} 추이 그래프. 누르면 그날 기록 상세`}
      />
    </div>
  );
}

// 추이에서 고른 날짜의 진료·검사와 산모 기록. 값·메모·사진을 한 번에 본다.
function DayDetail({
  day,
  events,
  dueDate,
  demo,
  onCheckup,
  onEditBody,
  onPhoto,
  onClose,
}: {
  day: string;
  events: PregnancyEvent[];
  dueDate: string | null;
  demo: boolean;
  onCheckup: (e: PregnancyEvent) => void;
  onEditBody: (e: PregnancyEvent) => void;
  onPhoto: (ids: string[], index: number) => void;
  onClose: () => void;
}) {
  const list = events
    .filter((e) => isMeasure(e.kind) && localDay(e.started_at) === day)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  return (
    <SheetFrame
      title={dayLabel(`${day}T00:00:00`)}
      sub={[weekText(dueDate, dayStart(day)), `기록 ${list.length}건`]
        .filter(Boolean)
        .join(" · ")}
    >
      {list.length ? (
        list.map((e) => {
          const facts = e.kind === "body" ? bodyFacts(e) : checkupFacts(e);
          return (
            <section className="pg-dd" key={e.id}>
              <div className="pg-dd-head">
                <span>
                  <i className={`pg-dot ${e.kind}`} />
                  {kindLabel[e.kind]} · {hm(e.started_at)}
                </span>
                <small>{e.created_by_name}</small>
              </div>
              {facts.length > 0 && (
                <dl className={`pg-facts ${e.kind}`}>
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {e.memo ? (
                <p className="pg-visit-memo">{e.memo}</p>
              ) : (
                <p className="pg-dd-none">메모 없음</p>
              )}
              {e.photo_ids.length > 0 && (
                <div className="pg-photos">
                  {e.photo_ids.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      className="pg-photo view"
                      aria-label={`사진 ${i + 1} 크게 보기`}
                      onClick={() => onPhoto(e.photo_ids, i)}
                    >
                      {!demo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoSrc(id, demo)} alt="" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {e.kind === "checkup" ? (
                <button
                  type="button"
                  className="pg-dd-link"
                  onClick={() => onCheckup(e)}
                >
                  {kindLabel.checkup} 상세 · 복사
                  <ChevronRight size={15} />
                </button>
              ) : (
                e.can_edit && (
                  <button
                    type="button"
                    className="pg-dd-link"
                    onClick={() => onEditBody(e)}
                  >
                    수정
                    <ChevronRight size={15} />
                  </button>
                )
              )}
            </section>
          );
        })
      ) : (
        <p className="pg-empty">이 날의 기록이 없습니다.</p>
      )}
      <div className="pg-actions single">
        <button type="button" className="pg-btn ghost muted" onClick={onClose}>
          닫기
        </button>
      </div>
    </SheetFrame>
  );
}
