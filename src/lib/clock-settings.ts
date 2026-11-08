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

export type ClockSettings = {
  font: ClockFont;
  weight: ClockWeight;
  digit: string; // 시계 숫자 색 #rrggbb
  info: string; // 날짜·날씨 색 #rrggbb
  seconds: ClockSeconds;
  blink: boolean; // 콜론 깜빡임
  padHour: boolean; // 1~9시 앞에 0
};

export const defaultClockSettings: ClockSettings = {
  font: "system",
  weight: 200,
  digit: "#f4f4f1",
  info: "#f4f4f1",
  seconds: "same",
  blink: true,
  padHour: false,
};

export const clockFontFamily = (id: ClockFont) =>
  clockFonts.find((f) => f.id === id)?.family ?? clockFonts[0].family;

const hex = /^#[0-9a-f]{6}$/i;

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
    blink: typeof v.blink === "boolean" ? v.blink : d.blink,
    padHour: typeof v.padHour === "boolean" ? v.padHour : d.padHour,
  };
}
