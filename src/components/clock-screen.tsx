"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  demoWeather,
  weatherLabel,
  weatherPlace,
  type TodayWeather,
  type WeatherKind,
} from "@/lib/weather";

// 취미 / 시계. iPad를 가로로 세워 계속 켜두는 검정 화면이다.
// 왼쪽 위 날짜, 오른쪽 위 오늘 날씨, 가운데 12시간제 시계. 화면을 누르면 나가기와 화면 켜짐 상태가 잠깐 보인다.
const WEATHER_REFRESH = 30 * 60 * 1000;
const CONTROLS_VISIBLE = 5000;
type Wake = "pending" | "on" | "off" | "unsupported";

export function ClockScreen({
  demo = false,
  href,
}: {
  demo?: boolean;
  href: (path: string) => string;
}) {
  const now = useMinute();
  const [loaded, setLoaded] = useState<TodayWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [controls, setControls] = useState(false);
  const wake = useWakeLock();
  const frameRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const dateKey = now ? localDate(now) : null;

  // 시계 화면이 떠 있는 동안 뒤의 앱 화면이 스크롤되지 않게 한다.
  useEffect(() => {
    document.documentElement.classList.add("clock-open");
    return () => document.documentElement.classList.remove("clock-open");
  }, []);

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
          setWeatherError(null);
        } else
          setWeatherError(
            r.status === 401
              ? "다시 로그인해 주세요"
              : "날씨를 불러오지 못했어요",
          );
      } catch {
        if (!cancelled) setWeatherError("날씨를 불러오지 못했어요");
      }
    };
    load();
    const timer = setInterval(load, WEATHER_REFRESH);
    // 잠자기·다른 앱에서 돌아왔을 때 오래된 값이면 바로 다시 받는다.
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoad > 10 * 60 * 1000
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

  // 시계 숫자를 가장 넓은 "12:00" 기준으로 화면 너비 84%, 남은 높이 92% 중 먼저 닿는 쪽에 맞춘다.
  useEffect(() => {
    const frame = frameRef.current;
    const head = headRef.current;
    const time = timeRef.current;
    if (!frame || !head || !time) return;
    const fit = () => {
      const cs = getComputedStyle(time);
      const probe = document.createElement("span");
      probe.textContent = "12:00";
      Object.assign(probe.style, {
        position: "absolute",
        visibility: "hidden",
        whiteSpace: "nowrap",
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        fontSize: "100px",
        lineHeight: String(
          parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 0.8,
        ),
        letterSpacing: "normal",
        fontVariantNumeric: "tabular-nums",
      });
      frame.appendChild(probe);
      const box = probe.getBoundingClientRect();
      probe.remove();
      const spacing =
        parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) || 0;
      const width = box.width + spacing * 100 * 5;
      const fs = getComputedStyle(frame);
      const height =
        frame.clientHeight -
        parseFloat(fs.paddingTop) -
        parseFloat(fs.paddingBottom) -
        head.offsetHeight;
      const size =
        100 *
        Math.min(
          (frame.clientWidth * 0.84) / width,
          (height * 0.92) / box.height,
        );
      time.style.fontSize = `${Math.max(size, 24)}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!controls) return;
    const timer = setTimeout(() => setControls(false), CONTROLS_VISIBLE);
    return () => clearTimeout(timer);
  }, [controls]);

  const parts = now ? clockParts(now) : null;
  // 둘러보기는 실제 API를 부르지 않고 예시 날씨를 보여준다.
  const weather = demo ? (dateKey ? demoWeather(dateKey) : null) : loaded;
  const sameDay = weather && dateKey && weather.date === dateKey;
  return (
    <div
      className="clock-screen"
      ref={frameRef}
      onClick={() => {
        setControls((v) => !v);
        if (wake.state !== "on") wake.retry();
      }}
    >
      <div className="clock-head" ref={headRef}>
        <span className="clock-date">{parts?.date}</span>
        <div className="clock-weather" aria-live="polite">
          {sameDay ? (
            <>
              <WeatherIcon kind={weather.kind} />
              <span className="clock-cond">
                {weatherLabel[weather.kind]}
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
              {weatherError ?? "날씨 확인 중"}
              <small>{weatherPlace.label}</small>
            </span>
          )}
        </div>
      </div>
      <div className="clock-face">
        <span className="clock-ampm">{parts?.ampm}</span>
        <div className="clock-time" ref={timeRef}>
          {parts ? (
            <>
              {parts.hour}
              <span className="clock-colon">:</span>
              {parts.minute}
            </>
          ) : (
            " "
          )}
        </div>
      </div>
      {controls && (
        <div className="clock-controls" onClick={(e) => e.stopPropagation()}>
          <Link href={href("/hobby")} className="clock-exit">
            <ArrowLeft size={18} />
            취미로
          </Link>
          <span className={`clock-wake ${wake.state}`}>
            {wake.state === "on"
              ? "화면 켜짐 유지 중"
              : "화면 켜짐 유지가 안 돼요 · iPad 자동 잠금을 꺼 주세요"}
          </span>
        </div>
      )}
    </div>
  );
}

// 분이 바뀔 때만 다시 그린다. 서버 렌더와 어긋나지 않게 첫 값은 마운트 후 채운다.
function useMinute() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow((prev) => {
        const d = new Date();
        return prev &&
          prev.getMinutes() === d.getMinutes() &&
          prev.getHours() === d.getHours()
          ? prev
          : d;
      });
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// 화면이 보이는 동안 자동 잠금을 막는다. 다른 앱에 다녀오면 풀리므로 다시 요청한다.
function useWakeLock() {
  const [state, setState] = useState<Wake>("pending");
  const request = useRef<() => void>(() => {});
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const ask = async () => {
      if (!("wakeLock" in navigator)) return setState("unsupported");
      if (document.visibilityState !== "visible" || lock) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) return void next.release();
        lock = next;
        setState("on");
        next.addEventListener("release", () => {
          lock = null;
          if (!stopped) setState("off");
        });
      } catch {
        setState("off");
      }
    };
    request.current = () => void ask();
    ask();
    const onVisible = () => {
      if (document.visibilityState === "visible") ask();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
  return { state, retry: () => request.current() };
}

function clockParts(d: Date) {
  const h = d.getHours();
  return {
    hour: String(h % 12 || 12),
    minute: String(d.getMinutes()).padStart(2, "0"),
    ampm: h < 12 ? "AM" : "PM",
    date: `${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일`,
  };
}

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function WeatherIcon({ kind }: { kind: WeatherKind }) {
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
      {kind === "clear" ? (
        <>
          <circle cx="24" cy="24" r="8.5" />
          <path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5" />
        </>
      ) : (
        <path d={cloud} />
      )}
      {kind === "rain" && <path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5" />}
      {kind === "snow" && (
        <path d="M16 37h0M24 39h0M32 37h0M20 43h0M28 43h0" strokeWidth="3.6" />
      )}
    </svg>
  );
}
