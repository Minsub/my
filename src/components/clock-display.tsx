"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  clockFontFamily,
  clockSpacingGap,
  type ClockSettings,
} from "@/lib/clock-settings";
import {
  demoWeather,
  weatherAt,
  weatherLabel,
  weatherPlace,
  type TodayWeather,
  type WeatherKind,
} from "@/lib/weather";

// 시계 + 날씨 화면 본체. 부모 크기를 꽉 채우고 모든 크기를 자기 너비(cqw) 기준으로 잡아서
// 전체 화면 시계와 설정 페이지 미리보기가 같은 모양으로 그려진다.
const WEATHER_REFRESH = 60 * 60 * 1000;
// 시계 줄(AM/PM 포함)이 크기 100%일 때 차지할 화면 너비. 글꼴 그대로 / 꽉 채움(좁게·보통·넓게)
const FACE_WIDTH = { font: 0.97, ink: 0.98 };
const SMALL_SECONDS = 0.5;
const LINE_HEIGHT = 0.78;

export function ClockDisplay({
  settings,
  demo = false,
}: {
  settings: ClockSettings;
  demo?: boolean;
}) {
  const now = useNow();
  const dateKey = now ? localDate(now) : null;
  const { weather, error } = useWeather(demo, dateKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const ampmRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const family = clockFontFamily(settings.font);
  const p = now ? clockParts(now, settings.padHour) : null;
  const ink = settings.spacing !== "font";
  // 글꼴 그대로는 가장 긴 12시대 자리를 늘 비워 두어 크기가 하루 내내 같다.
  const hourDigits = ink ? (p?.hour.length ?? 2) : 2;

  // 글꼴 그대로: 숫자 칸을 그 글꼴의 가장 넓은 숫자 글자 폭으로 고정하고 "12:00:00"이 화면 너비를 채우게 맞춘다.
  // 좁게·보통·넓게: 칸을 가장 넓은 숫자의 잉크 폭 + 간격으로 고정하고 지금 보이는 시:분:초가 화면을 꽉 채우게 맞춘다.
  // 어느 쪽이든 초가 바뀌어도 숫자가 흔들리지 않고, 세로로 늘인 높이가 먼저 닿으면 높이에 맞춘다.
  useEffect(() => {
    const root = rootRef.current;
    const head = headRef.current;
    const ampm = ampmRef.current;
    const time = timeRef.current;
    if (!root || !head || !ampm || !time) return;
    const fit = () => {
      const m = measure(family, settings.weight);
      const gap = clockSpacingGap(settings.spacing);
      const cell = ink ? m.digit + gap : m.digitAdvance;
      const colon = ink ? m.colon + gap * 1.6 : m.colonAdvance;
      const seconds =
        settings.seconds === "off"
          ? 0
          : (colon + 2 * cell) *
            (settings.seconds === "small" ? SMALL_SECONDS : 1);
      const units = hourDigits * cell + colon + 2 * cell + seconds;
      const stretch = settings.stretch / 100;
      const ampmSpace =
        ampm.offsetWidth +
        (parseFloat(getComputedStyle(ampm).marginRight) || 0);
      const width =
        root.clientWidth *
          FACE_WIDTH[ink ? "ink" : "font"] *
          (settings.size / 100) -
        ampmSpace;
      const rs = getComputedStyle(root);
      const height =
        root.clientHeight -
        head.offsetHeight -
        parseFloat(rs.paddingTop) -
        parseFloat(rs.paddingBottom);
      // 글꼴 그대로는 줄 상자 높이(0.78em), 꽉 채움은 숫자 잉크 높이로 높이 한도를 잰다.
      const tall = ink ? m.height / 0.94 : LINE_HEIGHT / 0.86;
      // 글꼴 그대로는 예전처럼 머리줄 아래 전체 높이를 기준으로 한다.
      const room = ink ? height : root.clientHeight - head.offsetHeight;
      const size = Math.max(
        Math.min(width / units, room / (tall * stretch)),
        12,
      );
      // 줄 상자 안에서 숫자 잉크의 세로 가운데(em). 가운데 줄과 세로 늘이기 기준점으로 쓴다.
      const middle =
        (LINE_HEIGHT - (m.ascent + m.descent)) / 2 + m.ascent - m.height / 2;
      time.style.fontSize = `${size}px`;
      time.style.setProperty("--cell", `${cell}em`);
      time.style.setProperty("--colon", `${colon}em`);
      time.style.setProperty("--middle", `${middle}em`);
      time.style.setProperty("--stretch", String(stretch));
    };
    fit();
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [
    family,
    settings.weight,
    settings.seconds,
    settings.spacing,
    settings.size,
    settings.stretch,
    hourDigits,
    ink,
  ]);

  const colon = <span className="clock-colon">:</span>;
  const cells = (s: string) =>
    s.split("").map((c, i) => (
      <span className="clock-d" key={i}>
        {c}
      </span>
    ));
  const today = weather && dateKey && weather.date === dateKey ? weather : null;
  const hour = today && now ? weatherAt(today, now.getHours()) : null;
  return (
    <div
      className="clock-display"
      ref={rootRef}
      style={
        {
          "--clock-digit": settings.digit,
          "--clock-info": settings.info,
          "--clock-font": family,
          "--clock-weight": settings.weight,
        } as CSSProperties
      }
    >
      <div className="clock-head" ref={headRef}>
        <span className="clock-date">{p?.date}</span>
        <div className="clock-weather" aria-live="polite">
          {today && hour ? (
            <>
              <WeatherIcon kind={hour.kind} night={!hour.isDay} />
              <span className="clock-cond">
                {weatherLabel[hour.kind]}
                <small>{today.place}</small>
              </span>
              <span className="clock-temps">
                <span className="clock-temp-now">
                  <small>지금</small>
                  <b>{hour.temp}°</b>
                </span>
                <span>
                  <small>최저</small>
                  <b>{today.min}°</b>
                </span>
                <span>
                  <small>최고</small>
                  <b>{today.max}°</b>
                </span>
              </span>
            </>
          ) : (
            <span className="clock-cond">
              {error ?? "날씨 확인 중"}
              <small>{weatherPlace.label}</small>
            </span>
          )}
        </div>
      </div>
      <div className={ink ? "clock-face ink" : "clock-face"}>
        <span
          className="clock-ampm"
          ref={ampmRef}
          style={p ? undefined : { visibility: "hidden" }}
        >
          {p?.ampm ?? "AM"}
        </span>
        <div
          className={settings.centerLine ? "clock-time lined" : "clock-time"}
          ref={timeRef}
        >
          {p && (
            <>
              {cells(p.hour)}
              {colon}
              {cells(p.minute)}
              {settings.seconds !== "off" && (
                <span
                  className={
                    settings.seconds === "small"
                      ? "clock-sec small"
                      : "clock-sec"
                  }
                >
                  {colon}
                  {cells(p.second)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 글꼴별 숫자·콜론 잉크 폭과 숫자 높이(em). 같은 글꼴은 한 번만 잰다.
type Metrics = {
  digit: number; // 잉크 폭
  colon: number;
  digitAdvance: number; // 글자 폭(양옆 여백 포함)
  colonAdvance: number;
  height: number;
  ascent: number;
  descent: number;
};
const measured = new Map<string, Metrics>();
let canvas: HTMLCanvasElement | null = null;
function measure(family: string, weight: number): Metrics {
  const key = `${family}|${weight}`;
  const hit = measured.get(key);
  if (hit && document.fonts?.status !== "loading") return hit;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return {
      digit: 0.6,
      colon: 0.2,
      digitAdvance: 0.6,
      colonAdvance: 0.3,
      height: 0.72,
      ascent: 0.95,
      descent: 0.25,
    };
  ctx.font = `${weight} 100px ${family}`;
  let digit = 0;
  let digitAdvance = 0;
  let height = 0;
  for (let n = 0; n <= 9; n++) {
    const t = ctx.measureText(String(n));
    digit = Math.max(digit, t.actualBoundingBoxLeft + t.actualBoundingBoxRight);
    height = Math.max(height, t.actualBoundingBoxAscent);
    digitAdvance = Math.max(digitAdvance, t.width);
  }
  const c = ctx.measureText(":");
  const zero = ctx.measureText("0");
  const value = {
    digit: digit / 100,
    colon: (c.actualBoundingBoxLeft + c.actualBoundingBoxRight) / 100,
    digitAdvance: digitAdvance / 100,
    colonAdvance: c.width / 100,
    height: height / 100,
    ascent: (zero.fontBoundingBoxAscent ?? 95) / 100,
    descent: (zero.fontBoundingBoxDescent ?? 25) / 100,
  };
  measured.set(key, value);
  return value;
}

// 매초 정각에 맞춰 다시 그린다. 첫 값은 마운트 후 채운다.
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 1000 - d.getMilliseconds() + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

// 1시간마다, 날짜가 바뀔 때, 30분 넘게 쉬었다 돌아왔을 때 다시 받는다.
// 시간별 값을 받아 두므로 지금 시각 칸은 화면이 매시 바꿔 고른다. 둘러보기는 예시 값만 쓴다.
function useWeather(demo: boolean, dateKey: string | null) {
  const [loaded, setLoaded] = useState<TodayWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!dateKey || demo) return;
    let cancelled = false;
    let lastLoad = 0;
    const load = async () => {
      lastLoad = Date.now();
      try {
        const r = await fetch("/api/weather", { cache: "no-store" });
        if (cancelled) return;
        if (r.ok) {
          setLoaded((await r.json()) as TodayWeather);
          setError(null);
        } else
          setError(
            r.status === 401
              ? "다시 로그인해 주세요"
              : "날씨를 불러오지 못했어요",
          );
      } catch {
        if (!cancelled) setError("날씨를 불러오지 못했어요");
      }
    };
    load();
    const timer = setInterval(load, WEATHER_REFRESH);
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoad > 30 * 60 * 1000
      )
        load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [demo, dateKey]);
  return {
    weather: demo ? (dateKey ? demoWeather(dateKey) : null) : loaded,
    error: demo ? null : error,
  };
}

function clockParts(d: Date, padHour: boolean) {
  const h = d.getHours() % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hour: padHour ? pad(h) : String(h),
    minute: pad(d.getMinutes()),
    second: pad(d.getSeconds()),
    ampm: d.getHours() < 12 ? "AM" : "PM",
    date: `${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일`,
  };
}

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function WeatherIcon({ kind, night }: { kind: WeatherKind; night: boolean }) {
  const cloud =
    kind === "cloudy"
      ? "M14 36h21a8 8 0 0 0 .8-16A11 11 0 0 0 14.6 22 7 7 0 0 0 14 36z"
      : "M14 29h21a8 8 0 0 0 .8-16A11 11 0 0 0 14.6 15 7 7 0 0 0 14 29z";
  return (
    <svg
      className="clock-icon"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "clear" && night && (
        <path d="M36 30A14 14 0 1 1 22 10a11 11 0 0 0 14 20z" />
      )}
      {kind === "clear" && !night && (
        <>
          <circle cx="24" cy="24" r="8.5" />
          <path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5" />
        </>
      )}
      {kind !== "clear" && <path d={cloud} />}
      {kind === "rain" && <path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5" />}
      {kind === "snow" && (
        <path d="M16 37h0M24 39h0M32 37h0M20 43h0M28 43h0" strokeWidth="3.6" />
      )}
    </svg>
  );
}
