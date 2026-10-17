// 꼬미 / 임신 기록의 공통 규칙. 화면과 서버가 같은 정의를 쓴다.
export const pregnancyKinds = [
  "tightening",
  "pain",
  "bleeding",
  "checkup",
  "body",
  "movement",
] as const;
export type PregnancyKind = (typeof pregnancyKinds)[number];
export const timedKinds = ["tightening", "pain"] as const;
export type TimedKind = (typeof timedKinds)[number];
export const isTimed = (k: PregnancyKind): k is TimedKind =>
  k === "tightening" || k === "pain";
// 지금 기록의 버튼과 직접 입력 시트로 남기는 타입. 배뭉침·통증은 시작·종료 타이머, 태동은 누르는 순간
// 한 시점(시작=종료, 지속 0)이다. 태동은 진통 상태 판정(timedKinds)에는 넣지 않는다.
export const tapKinds = ["tightening", "pain", "movement"] as const;
export type TapKind = (typeof tapKinds)[number];
export const isTapKind = (k: PregnancyKind): k is TapKind =>
  isTimed(k) || k === "movement";
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
  movement: "태동",
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
// 태동의 강도는 하·중·상으로 부른다. 저장 값은 같은 1~3이다.
export const movementIntensityLabel = ["하", "중", "상"] as const;
export const intensityText = (k: PregnancyKind, n: number) =>
  (k === "movement" ? movementIntensityLabel : intensityLabel)[n - 1];
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

// ── 태동 ──
// 태동은 진통 상태(pregnancyLevel)와 따로 하루 단위 횟수로 본다. 버튼을 한 번 누른 것이 1회다.
// 날짜는 입력하는 기기 시간대의 자정 기준이다.
// 평소 기준은 오늘을 뺀 최근 7일 중 기록이 있는 날만 쓴다. 기록하지 않은 날을 0회로 보면 평소가 낮아진다.
export const MOVEMENT_BASELINE_DAYS = 7;
export const MOVEMENT_CHART_DAYS = 14;
export type MovementDay = {
  day: string; // YYYY-MM-DD
  start: number;
  count: number;
  // 그날 0시부터 지금과 같은 시각까지의 횟수. 오늘과 지난날을 같은 시간만큼 비교한다.
  byNow: number;
};
const dayId = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// 오늘(0번)부터 지난 days-1일까지 하루별 태동 횟수.
export function movementDays(
  events: PregnancyEvent[],
  now: number,
  days: number,
): MovementDay[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const sinceMidnight = now - today.getTime();
  const list: MovementDay[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return { day: dayId(d.getTime()), start: d.getTime(), count: 0, byNow: 0 };
  });
  const index = new Map(list.map((d, i) => [d.day, i]));
  for (const e of events) {
    if (e.kind !== "movement") continue;
    const s = t(e.started_at);
    const i = index.get(dayId(s));
    if (i === undefined || s > now) continue;
    list[i].count++;
    if (s - list[i].start <= sinceMidnight) list[i].byNow++;
  }
  return list;
}

// 태동 비교 기준. 의학적 진단 기준이 아니라 앱이 기록을 견주는 참고값이다(2026-10 결정).
// - 28주 전에는 태동이 불규칙해 비교하지 않는다(규칙적으로 살피기 시작하는 흔한 시점).
// - 평소 = 오늘을 뺀 최근 7일 중 기록이 있는 날의 "같은 시각까지 횟수" 평균. 그런 날이 4일 이상이어야 견준다.
// - 오늘 같은 시각까지 횟수가 평소의 절반 미만이면 집중해서 세어 보라고 안내한다.
//   평소가 4회 미만인 이른 시각에는 견주지 않는다.
// - 집중해서 셀 때의 참고: 2시간 안에 10회(ACOG 인용 병원 안내). 기관마다 다르다(SOGC 2시간 6회).
export const MOVEMENT_FROM_WEEKS = 28;
export const MOVEMENT_NO_FEEL_WEEKS = 24;
export const MOVEMENT_MIN_BASELINE_DAYS = 4;
export const MOVEMENT_MIN_USUAL = 4;
export const MOVEMENT_LOW_RATIO = 0.5;
export const KICK_TARGET = 10;
export const KICK_WINDOW_MIN = 120;

export type MovementLevel = "early" | "learning" | "usual" | "low";
export type MovementStatus = {
  level: MovementLevel;
  weeks: number | null;
  today: number;
  // 평소 같은 시각까지의 횟수. 비교할 날이 모자라면 null.
  usual: number | null;
  baselineDays: number;
  // 최근 2시간(KICK_WINDOW_MIN) 횟수.
  recent: number;
  // 기록이 한 번도 없다.
  never: boolean;
};
export function movementStatus(
  events: PregnancyEvent[],
  now: number,
  weeks: number | null,
): MovementStatus {
  const days = movementDays(events, now, MOVEMENT_BASELINE_DAYS + 1);
  const base = days.slice(1).filter((d) => d.count > 0);
  const usual =
    base.length >= MOVEMENT_MIN_BASELINE_DAYS
      ? base.reduce((a, d) => a + d.byNow, 0) / base.length
      : null;
  const recent = events.filter((e) => {
    if (e.kind !== "movement") return false;
    const s = t(e.started_at);
    return s <= now && s >= now - KICK_WINDOW_MIN * MIN;
  }).length;
  const today = days[0].byNow;
  const level: MovementLevel =
    weeks !== null && weeks < MOVEMENT_FROM_WEEKS
      ? "early"
      : usual === null
        ? "learning"
        : usual >= MOVEMENT_MIN_USUAL && today < usual * MOVEMENT_LOW_RATIO
          ? "low"
          : "usual";
  return {
    level,
    weeks,
    today,
    usual,
    baselineDays: base.length,
    recent,
    never: !events.some((e) => e.kind === "movement"),
  };
}
