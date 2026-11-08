"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { ClockDisplay } from "./clock-display";
import { useClockSettings } from "./use-clock-settings";

// 취미 / 시계 / 시계 보기. iPad를 가로로 세워 계속 켜두는 검정 전체 화면이다.
// 화면을 누르면 시계 메뉴·설정 이동과 화면 켜짐 상태가 잠깐 보인다.
const CONTROLS_VISIBLE = 5000;
type Wake = "pending" | "on" | "off" | "unsupported";

export function ClockScreen({
  demo = false,
  href,
}: {
  demo?: boolean;
  href: (path: string) => string;
}) {
  const { settings } = useClockSettings(demo);
  const [controls, setControls] = useState(false);
  const wake = useWakeLock();

  // 시계 화면이 떠 있는 동안 뒤의 앱 화면이 스크롤되지 않게 한다.
  useEffect(() => {
    document.documentElement.classList.add("clock-open");
    return () => document.documentElement.classList.remove("clock-open");
  }, []);

  useEffect(() => {
    if (!controls) return;
    const timer = setTimeout(() => setControls(false), CONTROLS_VISIBLE);
    return () => clearTimeout(timer);
  }, [controls]);

  return (
    <div
      className="clock-screen"
      onClick={() => {
        setControls((v) => !v);
        if (wake.state !== "on") wake.retry();
      }}
    >
      <ClockDisplay settings={settings} demo={demo} />
      {controls && (
        <div className="clock-controls" onClick={(e) => e.stopPropagation()}>
          <div className="clock-control-links">
            <Link href={href("/hobby/clock")} className="clock-exit">
              <ArrowLeft size={18} />
              시계 메뉴
            </Link>
            <Link href={href("/hobby/clock/settings")} className="clock-exit">
              <SlidersHorizontal size={17} />
              설정
            </Link>
          </div>
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
