// 꼬미 / 임신 중 통증 기록의 공통 규칙. 화면과 서버가 같은 정의를 쓴다.
export const pregnancyKinds = ["tightening", "pain", "bleeding"] as const;
export type PregnancyKind = (typeof pregnancyKinds)[number];
export const timedKinds = ["tightening", "pain"] as const;
export type TimedKind = (typeof timedKinds)[number];
export const bleedingAmounts = [
  "none",
  "spotting",
  "light",
  "moderate",
  "heavy",
] as const;
export type BleedingAmount = (typeof bleedingAmounts)[number];
export const bleedingColors = ["brown", "pink", "red", "dark"] as const;
export type BleedingColor = (typeof bleedingColors)[number];

export const kindLabel: Record<PregnancyKind, string> = {
  tightening: "배뭉침",
  pain: "통증",
  bleeding: "출혈",
};
export const bleedingLabel: Record<BleedingAmount, string> = {
  none: "출혈 없음",
  spotting: "묻어남",
  light: "소량",
  moderate: "중간",
  heavy: "많음",
};
export const colorLabel: Record<BleedingColor, { label: string; hex: string }> =
  {
    brown: { label: "갈색", hex: "#7a4a2e" },
    pink: { label: "분홍", hex: "#e39aa3" },
    red: { label: "선홍", hex: "#d8283b" },
    dark: { label: "검붉은", hex: "#6e1420" },
  };
export const intensityLabel = ["약", "중", "강"] as const;

// 기준값. 사용자가 바꾸지 않는 고정값이다(2026-09 결정).
// 잦아지는 중: 최근 1시간 4회. 국내 병원 안내(1시간 3회 이상 상담)와 ACOG 경고(10분마다)의 사이.
// 병원 연락 권장: 20분 4회 또는 1시간 8회. 조기진통 진단에 쓰는 수축 빈도와 같은 수치.
export const WATCH_PER_HOUR = 4;
export const CALL_PER_20_MIN = 4;
export const CALL_PER_HOUR = 8;
// 이보다 오래 쉬면 간격을 잇지 않고 새 구간으로 센다.
export const SESSION_GAP_MIN = 60;
// DB CHECK와 같은 값. 이보다 긴 배뭉침·통증은 종료를 잊은 기록으로 본다.
export const MAX_DURATION_MIN = 60;
export const MAX_PHOTOS = 4;
export const TERM_WEEKS = 37;

export type PregnancyEvent = {
  id: string;
  kind: PregnancyKind;
  started_at: string;
  ended_at: string | null;
  intensity: 1 | 2 | 3 | null;
  bleeding: BleedingAmount | null;
  bleeding_color: BleedingColor | null;
  memo: string;
  version: number;
  created_by: string;
  created_by_name: string;
  photo_ids: string[];
  can_edit: boolean;
};
export type PregnancySettings = { due_date: string | null; version: number };
export type PregnancyData = {
  settings: PregnancySettings;
  events: PregnancyEvent[];
};

const MIN = 60000;
const t = (iso: string) => new Date(iso).getTime();
export const durationSec = (e: PregnancyEvent) =>
  e.ended_at ? (t(e.ended_at) - t(e.started_at)) / 1000 : null;

export type IntervalEvent = PregnancyEvent & {
  // 이전 시작부터 이번 시작까지. 새 구간의 첫 기록이면 null.
  interval: number | null;
  breakBefore: boolean;
};
// 같은 타입끼리 시작 시각 순으로 간격을 계산한다.
export function withIntervals(
  events: PregnancyEvent[],
  kind: PregnancyKind,
): IntervalEvent[] {
  const list = events
    .filter((e) => e.kind === kind)
    .sort((a, b) => t(a.started_at) - t(b.started_at));
  return list.map((e, i) => {
    const prev = list[i - 1];
    const gap = prev ? t(e.started_at) - t(prev.started_at) : null;
    const interval = gap !== null && gap <= SESSION_GAP_MIN * MIN ? gap : null;
    return {
      ...e,
      interval: interval === null ? null : interval / 1000,
      breakBefore: !!prev && interval === null,
    };
  });
}
const avg = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
export function kindStats(
  events: PregnancyEvent[],
  kind: PregnancyKind,
  from: number,
) {
  const list = withIntervals(events, kind).filter(
    (e) => t(e.started_at) >= from,
  );
  return {
    list,
    count: list.length,
    avgDuration: avg(
      list.map(durationSec).filter((v): v is number => v !== null),
    ),
    avgInterval: avg(
      list.map((e) => e.interval).filter((v): v is number => v !== null),
    ),
  };
}

export type PregnancyLevel = "calm" | "watch" | "call";
export function pregnancyLevel(
  events: PregnancyEvent[],
  now: number,
): PregnancyLevel {
  let level: PregnancyLevel = "calm";
  for (const kind of timedKinds) {
    const starts = events
      .filter((e) => e.kind === kind)
      .map((e) => t(e.started_at));
    const in60 = starts.filter((s) => s >= now - 60 * MIN && s <= now).length;
    const in20 = starts.filter((s) => s >= now - 20 * MIN && s <= now).length;
    if (in20 >= CALL_PER_20_MIN || in60 >= CALL_PER_HOUR) return "call";
    if (in60 >= WATCH_PER_HOUR) level = "watch";
  }
  return level;
}

// 출산예정일을 40주 0일로 보고 오늘의 주수를 계산한다.
export function pregnancyWeek(dueDate: string | null, now: number) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00").getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = 280 - Math.round((due - today.getTime()) / 86400000);
  if (days < 0 || days > 44 * 7) return null;
  return { weeks: Math.floor(days / 7), days: days % 7 };
}

// 배뭉침·통증을 하나의 증상으로 볼 때의 단위. 시간이 겹치는 기록(배뭉침 중에 통증 시작 등)은
// 한 번의 증상으로 묶는다. 간격은 증상 시작 → 다음 증상 시작이며 SESSION_GAP_MIN보다 길면 새 구간이다.
export type SymptomEpisode = {
  events: PregnancyEvent[];
  start: number;
  end: number;
  interval: number | null;
  breakBefore: boolean;
};
export function symptomEpisodes(events: PregnancyEvent[]): SymptomEpisode[] {
  const list = events
    .filter((e) => e.kind !== "bleeding" && e.ended_at)
    .sort((a, b) => t(a.started_at) - t(b.started_at));
  const episodes: SymptomEpisode[] = [];
  for (const e of list) {
    const s = t(e.started_at),
      end = t(e.ended_at!);
    const last = episodes[episodes.length - 1];
    if (last && s <= last.end) {
      last.events.push(e);
      last.end = Math.max(last.end, end);
      continue;
    }
    const gap = last ? s - last.start : null;
    const interval = gap !== null && gap <= SESSION_GAP_MIN * MIN ? gap : null;
    episodes.push({
      events: [e],
      start: s,
      end,
      interval: interval === null ? null : interval / 1000,
      breakBefore: !!last && interval === null,
    });
  }
  return episodes;
}
export function symptomStats(events: PregnancyEvent[], from: number) {
  const all = symptomEpisodes(events);
  const list = all.filter((e) => e.start >= from);
  return {
    list,
    count: list.length,
    avgDuration: avg(list.map((e) => (e.end - e.start) / 1000)),
    avgInterval: avg(
      list.map((e) => e.interval).filter((v): v is number => v !== null),
    ),
  };
}
