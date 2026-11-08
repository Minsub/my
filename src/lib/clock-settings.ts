// 취미 / 시계 화면 설정. 기기마다 다르게 쓰는 표시 취향이라 서버가 아니라 그 기기 브라우저(localStorage)에 둔다.
// 글꼴은 iPad·Mac에 기본으로 있는 글꼴만 써서 따로 받지 않는다.
export const clockFonts = [
  {
    id: "system",
    label: "기본",
    family:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
  },
  {
    id: "rounded",
    label: "둥근",
    family:
      'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    id: "condensed",
    label: "좁은",
    family: '"Avenir Next Condensed", "Arial Narrow", sans-serif',
  },
  {
    id: "serif",
    label: "세리프",
    family: 'ui-serif, "New York", Georgia, serif',
  },
  {
    id: "didot",
    label: "디도",
    family: 'Didot, "Bodoni 72", "Times New Roman", serif',
  },
  {
    id: "mono",
    label: "고정폭",
    family: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  // 플립 시계 모양. 이 글꼴을 고르면 굵게·좁은 간격·가운데 줄·세로 130%가 함께 적용된다.
  {
    id: "flip",
    label: "플립",
    family:
      '"HelveticaNeue-CondensedBold", "Helvetica Neue Condensed Bold", "Arial Narrow", sans-serif',
  },
] as const;
export type ClockFont = (typeof clockFonts)[number]["id"];

export const clockWeights = [
  { value: 200, label: "얇게" },
  { value: 400, label: "보통" },
  { value: 700, label: "굵게" },
] as const;
export type ClockWeight = (typeof clockWeights)[number]["value"];

export const clockColors = [
  { value: "#f4f4f1", label: "흰색" },
  { value: "#d9d9d6", label: "밝은 회색" },
  { value: "#ece4d4", label: "웜화이트" },
  { value: "#ffb347", label: "앰버" },
  { value: "#a9c79f", label: "세이지" },
  { value: "#8fc3ec", label: "하늘" },
  { value: "#ff6b57", label: "레드" },
] as const;

export const clockSecondsModes = [
  { value: "same", label: "같은 크기" },
  { value: "small", label: "작게" },
  { value: "off", label: "숨김" },
] as const;
export type ClockSeconds = (typeof clockSecondsModes)[number]["value"];

// 숫자 사이 간격. "글꼴 그대로"는 글꼴의 글자 폭으로 칸을 잡고 가장 긴 12시대 기준으로 크기를 맞춘다.
// 나머지는 그 글꼴에서 잉크가 가장 넓은 숫자 + 간격(글자 크기 대비)으로 칸을 잡고 지금 시간이 화면을 꽉 채우게 맞춘다.
export const clockSpacings = [
  { value: "font", label: "글꼴 그대로", gap: 0 },
  { value: "tight", label: "좁게", gap: 0.05 },
  { value: "normal", label: "보통", gap: 0.12 },
  { value: "wide", label: "넓게", gap: 0.22 },
] as const;
export type ClockSpacing = (typeof clockSpacings)[number]["value"];

export const clockSizeRange = { min: 60, max: 100, step: 5 }; // 화면 너비를 채우는 비율 %
export const clockStretchRange = { min: 100, max: 180, step: 5 }; // 세로로 늘이는 비율 %

export type ClockSettings = {
  font: ClockFont;
  weight: ClockWeight;
  digit: string; // 시계 숫자 색 #rrggbb
  info: string; // 날짜·날씨 색 #rrggbb
  seconds: ClockSeconds;
  spacing: ClockSpacing;
  size: number;
  stretch: number;
  centerLine: boolean; // 숫자 가운데 가로줄(플립 시계 느낌)
  padHour: boolean; // 1~9시 앞에 0
};

export const defaultClockSettings: ClockSettings = {
  font: "system",
  weight: 200,
  digit: "#f4f4f1",
  info: "#f4f4f1",
  seconds: "same",
  spacing: "font",
  size: 100,
  stretch: 100,
  centerLine: false,
  padHour: false,
};

// 글꼴을 고를 때 함께 바꾸는 모양. 플립만 자기 모양이 있고 나머지는 기본 모양으로 돌아간다.
type ClockLook = Pick<
  ClockSettings,
  "weight" | "spacing" | "centerLine" | "stretch"
>;
export function clockFontLook(id: ClockFont): Partial<ClockLook> {
  if (id === "flip")
    return { weight: 700, spacing: "tight", centerLine: true, stretch: 130 };
  return { spacing: "font", centerLine: false, stretch: 100 };
}

export const clockFontFamily = (id: ClockFont) =>
  clockFonts.find((f) => f.id === id)?.family ?? clockFonts[0].family;

export const clockSpacingGap = (value: ClockSpacing) =>
  clockSpacings.find((s) => s.value === value)?.gap ?? clockSpacings[0].gap;

const hex = /^#[0-9a-f]{6}$/i;

function inRange(
  value: unknown,
  range: { min: number; max: number; step: number },
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const stepped = Math.round(value / range.step) * range.step;
  return Math.min(range.max, Math.max(range.min, stepped));
}

// 저장값이 깨졌거나 예전 형식이어도 항목별로 기본값을 채운다.
export function parseClockSettings(raw: string | null): ClockSettings {
  let v: Partial<Record<keyof ClockSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") v = parsed;
  } catch {}
  const d = defaultClockSettings;
  return {
    font: clockFonts.some((f) => f.id === v.font)
      ? (v.font as ClockFont)
      : d.font,
    weight: clockWeights.some((w) => w.value === v.weight)
      ? (v.weight as ClockWeight)
      : d.weight,
    digit: typeof v.digit === "string" && hex.test(v.digit) ? v.digit : d.digit,
    info: typeof v.info === "string" && hex.test(v.info) ? v.info : d.info,
    seconds: clockSecondsModes.some((m) => m.value === v.seconds)
      ? (v.seconds as ClockSeconds)
      : d.seconds,
    spacing: clockSpacings.some((s) => s.value === v.spacing)
      ? (v.spacing as ClockSpacing)
      : d.spacing,
    size: inRange(v.size, clockSizeRange, d.size),
    stretch: inRange(v.stretch, clockStretchRange, d.stretch),
    centerLine: typeof v.centerLine === "boolean" ? v.centerLine : d.centerLine,
    padHour: typeof v.padHour === "boolean" ? v.padHour : d.padHour,
  };
}
