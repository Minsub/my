"use client";
import { useEffect, useRef, useState } from "react";

// 화면이 보이는 동안 자동 잠금을 막는다. 다른 앱에 다녀오면 풀리므로 다시 요청한다.
// 시계 보기와 냉장고 전체 화면처럼 iPad를 세워 두고 계속 보는 화면에서 쓴다.
export type WakeState = "pending" | "on" | "off" | "unsupported";

export function useWakeLock() {
  const [state, setState] = useState<WakeState>("pending");
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
