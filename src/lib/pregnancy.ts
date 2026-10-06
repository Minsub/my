// 꼬미 / 임신 기록의 공통 규칙. 화면과 서버가 같은 정의를 쓴다.
export const pregnancyKinds = [
  "tightening",
  "pain",
  "bleeding",
  "checkup",
  "body",
] as const;
export type PregnancyKind = (typeof pregnancyKinds)[number];
export const timedKinds = ["tightening", "pain"] as const;
export type TimedKind = (typeof timedKinds)[number];
export const isTimed = (k: PregnancyKind): k is TimedKind =>
  k === "tightening" || k === "pain";
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
export const amnioticLevels = ["enough", "low"] as const;
export type AmnioticFluid = (typeof amnioticLevels)[number];

export const kindLabel: Record<PregnancyKind, string> = {
  tightening: "배뭉침",
  pain: "통증",
  bleeding: "출혈",
  // 진료·NST처럼 형식이 없는 병원 기록. 이름은 이 한 곳에서 바꾼다.
  checkup: "진료·검사",
  // 산모의 몸무게·배둘레. 집에서 자주 재는 값이라 병원 기록과 따로 둔다.
  body: "산모",
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
export const amnioticLabel: Record<AmnioticFluid, string> = {
  enough: "충분",
  low: "부족",
};

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
// 사진을 붙일 수 있는 타입과 기록당 장수. 진료·검사의 10장은 DB position(0~9)의 한도다.
export const photoLimit = { bleeding: 4, checkup: 10 } as const;
export type PhotoKind = keyof typeof photoLimit;
export const MAX_PHOTOS = Math.max(...Object.values(photoLimit));
export const hasPhotos = (k: PregnancyKind): k is PhotoKind => k in photoLimit;
// 메모 길이. 진료 메모만 길게 둔다(DB CHECK와 같은 값).
export const memoLimit = (k: PregnancyKind) => (k === "checkup" ? 2000 : 500);
// 진료·검사 입력 범위(DB CHECK와 같은 값).
export const CERVIX_MAX_CM = 8;
export const FETAL_HR_MIN = 50;
export const FETAL_HR_MAX = 250;
// 아기 몸무게(초음파 추정 체중)는 g 정수.
export const FETAL_WEIGHT_MIN_G = 1;
export const FETAL_WEIGHT_MAX_G = 7000;
export const TERM_WEEKS = 37;
// 산모 기록 입력 범위(DB CHECK와 같은 값). 소수 한 자리까지 저장한다.
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 200;
export const BELLY_MIN_CM = 40;
export const BELLY_MAX_CM = 200;

export type PregnancyEvent = {
  id: string;
  kind: PregnancyKind;
  started_at: string;
  ended_at: string | null;
  intensity: 1 | 2 | 3 | null;
  bleeding: BleedingAmount | null;
  bleeding_color: BleedingColor | null;
  cervix_length_cm: number | null;
  amniotic_fluid: AmnioticFluid | null;
  fetal_heart_rate: number | null;
  fetal_weight_g: number | null;
  weight_kg: number | null;
  belly_cm: number | null;
  memo: string;
  version: number;
  created_by: string;
  created_by_name: string;
  photo_ids: string[];
  can_edit: boolean;
};
export type PregnancySettings = {
  due_date: string | null;
  pre_weight_kg: number | null;
  version: number;
};
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
    .filter((e) => isTimed(e.kind) && e.ended_at)
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

// 진료·검사의 따로 입력한 값. 목록·상세·복사 문구가 같은 표기를 쓴다.
export function checkupFacts(e: PregnancyEvent) {
  const facts: { label: string; value: string }[] = [];
  if (e.cervix_length_cm !== null)
    facts.push({ label: "자궁경부길이", value: `${e.cervix_length_cm}cm` });
  if (e.amniotic_fluid)
    facts.push({ label: "양수량", value: amnioticLabel[e.amniotic_fluid] });
  if (e.fetal_heart_rate !== null)
    facts.push({ label: "아기 심박수", value: `${e.fetal_heart_rate}bpm` });
  if (e.fetal_weight_g !== null)
    facts.push({
      label: "아기 몸무게",
      value: `${e.fetal_weight_g.toLocaleString("ko-KR")}g`,
    });
  return facts;
}

// 산모 기록의 값. 목록·상세가 같은 표기를 쓴다.
export function bodyFacts(e: PregnancyEvent) {
  const facts: { label: string; value: string }[] = [];
  if (e.weight_kg !== null)
    facts.push({ label: "몸무게", value: `${e.weight_kg}kg` });
  if (e.belly_cm !== null)
    facts.push({ label: "배둘레", value: `${e.belly_cm}cm` });
  return facts;
}

// 추이 그래프의 항목. 값은 기록의 한 칸에서 읽는다.
// 참고 범위는 진단 기준이 아니라 눈으로 비교할 선이다:
// 자궁경부 2.5cm 미만은 짧은 경부로 보는 흔한 기준, 태아 심박 110~160bpm은 정상 범위로 쓰는 값.
export type TrendMetric = {
  key:
    | "weight_kg"
    | "belly_cm"
    | "cervix_length_cm"
    | "fetal_heart_rate"
    | "fetal_weight_g";
  label: string;
  unit: string;
  kind: "body" | "checkup";
  digits: number;
  // 세로축을 0에서 시작한다. 주수에 따라 값이 수십 배로 커져 여백이 음수까지 내려가는 항목.
  zero?: boolean;
  line?: { value: number; label: string };
  band?: { from: number; to: number; label: string };
};
export const trendMetrics: TrendMetric[] = [
  { key: "weight_kg", label: "몸무게", unit: "kg", kind: "body", digits: 1 },
  { key: "belly_cm", label: "배둘레", unit: "cm", kind: "body", digits: 1 },
  {
    key: "cervix_length_cm",
    label: "자궁경부길이",
    unit: "cm",
    kind: "checkup",
    digits: 2,
    line: { value: 2.5, label: "참고 2.5cm" },
  },
  {
    key: "fetal_heart_rate",
    label: "아기 심박수",
    unit: "bpm",
    kind: "checkup",
    digits: 0,
    band: { from: 110, to: 160, label: "참고 110~160" },
  },
  {
    key: "fetal_weight_g",
    label: "아기 몸무게",
    unit: "g",
    kind: "checkup",
    digits: 0,
    zero: true,
  },
];
export const isMeasure = (k: PregnancyKind) => k === "checkup" || k === "body";
