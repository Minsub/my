"use client";
import { useSyncExternalStore } from "react";
import {
  defaultClockSettings,
  parseClockSettings,
  type ClockSettings,
} from "@/lib/clock-settings";

// 시계 설정은 이 기기 브라우저에만 둔다. iOS 홈 화면 앱은 Safari와 저장소가 따로라 각자 설정한다.
// 둘러보기(demo)에서는 바꿔 볼 수만 있고 저장하지 않는다.
const KEY = "mono.clock.settings.v1";
const listeners = new Set<() => void>();
let memory: string | null = null;
let cache: { raw: string | null; value: ClockSettings } | null = null;

function readRaw(demo: boolean) {
  if (demo) return memory;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function snapshot(demo: boolean) {
  const raw = readRaw(demo);
  if (!cache || cache.raw !== raw)
    cache = { raw, value: parseClockSettings(raw) };
  return cache.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useClockSettings(demo = false) {
  const settings = useSyncExternalStore(
    subscribe,
    () => snapshot(demo),
    () => defaultClockSettings,
  );
  const save = (next: ClockSettings | null) => {
    const raw = next ? JSON.stringify(next) : null;
    memory = raw;
    if (!demo)
      try {
        if (raw) localStorage.setItem(KEY, raw);
        else localStorage.removeItem(KEY);
      } catch {}
    listeners.forEach((l) => l());
  };
  return {
    settings,
    // 화면이 다시 그려지기 전에 연달아 바꿔도 앞 변경이 덮이지 않게 저장된 최신 값에 합친다.
    update: (patch: Partial<ClockSettings>) =>
      save({ ...snapshot(demo), ...patch }),
    reset: () => save(null),
  };
}
