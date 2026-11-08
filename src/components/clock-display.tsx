"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { clockFontFamily, type ClockSettings } from "@/lib/clock-settings";
import {
  demoWeather,
  weatherLabel,
  weatherPlace,
  type TodayWeather,
  type WeatherKind,
} from "@/lib/weather";

// 시계 + 날씨 화면 본체. 부모 크기를 꽉 채우고 모든 크기를 자기 너비(cqw) 기준으로 잡아서
// 전체 화면 시계와 설정 페이지 미리보기가 같은 모양으로 그려진다.
const WEATHER_REFRESH = 15 * 60 * 1000;
const FACE_WIDTH = 0.97; // 시계 줄(AM/PM 포함)이 차지할 화면 너비
const SMALL_SECONDS = 0.5;

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

  // 숫자 칸 너비를 그 글꼴의 가장 넓은 숫자로 고정해 초가 바뀌어도 흔들리지 않게 하고,
  // 가장 긴 "12:00:00"이 화면 너비를 채우는 크기로 맞춘다. 높이가 먼저 닿으면 높이에 맞춘다.
  useEffect(() => {
    const root = rootRef.current;
    const head = headRef.current;
    const ampm = ampmRef.current;
    const time = timeRef.current;
    if (!root || !head || !ampm || !time) return;
    const fit = () => {
      const m = measure(root, family, settings.weight);
      const pair = 2 * m.cell;
      const units =
        pair +
        m.colon +
        pair +
        (settings.seconds === "off"
          ? 0
          : (m.colon + pair) *
            (settings.seconds === "small" ? SMALL_SECONDS : 1));
      const gap = parseFloat(getComputedStyle(ampm).marginRight) || 0;
      const width = root.clientWidth * FACE_WIDTH - ampm.offsetWidth - gap;
      const height = (root.clientHeight - head.offsetHeight) * 0.86;
      const size = Math.max(Math.min(width / units, height / 0.78), 12);
      time.style.fontSize = `${size}px`;
      time.style.setProperty("--cell", `${m.cell}em`);
      time.style.setProperty("--colon", `${m.colon}em`);
    };
    fit();
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [family, settings.weight, settings.seconds]);

  const p = now ? clockParts(now, settings.padHour) : null;
  const colonOn = !settings.blink || !now || now.getMilliseconds() < 500;
  const colon = (
    <span className={colonOn ? "clock-colon" : "clock-colon off"}>:</span>
  );
  const cells = (s: string) =>
    s.split("").map((c, i) => (
      <span className="clock-d" key={i}>
        {c}
      </span>
    ));
  const sameDay = weather && dateKey && weather.date === dateKey;
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
          {sameDay ? (
            <>
              <WeatherIcon kind={weather.now.kind} night={!weather.now.isDay} />
              <b className="clock-now">{weather.now.temp}°</b>
              <span className="clock-cond">
                {weatherLabel[weather.now.kind]}
                <small>{weather.place}</small>
              </span>
              <span className="clock-temps">
                <span>
                  <small>최저</small>
                  <b>{weather.min}°</b>
                </span>
                <span>
                  <small>최고</small>
                  <b>{weather.max}°</b>
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
      <div className="clock-face">
        <span
          className="clock-ampm"
          ref={ampmRef}
          style={p ? undefined : { visibility: "hidden" }}
        >
          {p?.ampm ?? "AM"}
        </span>
        <div className="clock-time" ref={timeRef}>
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

// 글꼴별 숫자 칸·콜론 너비(em). 같은 글꼴은 한 번만 잰다.
const measured = new Map<string, { cell: number; colon: number }>();
function measure(root: HTMLElement, family: string, weight: number) {
  const key = `${family}|${weight}`;
  const hit = measured.get(key);
  if (hit && document.fonts?.status !== "loading") return hit;
  const probe = document.createElement("span");
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "nowrap",
    fontFamily: family,
    fontWeight: String(weight),
    fontSize: "100px",
    letterSpacing: "normal",
  });
  root.appendChild(probe);
  const width = (text: string) => {
    probe.textContent = text;
    return probe.getBoundingClientRect().width / 100;
  };
  let cell = 0;
  for (let n = 0; n <= 9; n++) cell = Math.max(cell, width(String(n)));
  const colon = width(":");
  probe.remove();
  const value = { cell, colon };
  measured.set(key, value);
  return value;
}

// 0.5초마다(정각에 맞춰) 다시 그린다. 콜론 깜빡임과 초 표시에 쓴다. 첫 값은 마운트 후 채운다.
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 500 - (d.getMilliseconds() % 500) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

// 15분마다, 날짜가 바뀔 때, 오래 쉬었다 돌아왔을 때 다시 받는다. 둘러보기는 예시 값만 쓴다.
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
        Date.now() - lastLoad > 5 * 60 * 1000
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
