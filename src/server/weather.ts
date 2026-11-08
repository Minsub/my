import { AppError } from "./security";
import { today } from "@/lib/format";
import { weatherKind, weatherPlace, type TodayWeather } from "@/lib/weather";

// 시계 화면용 오늘 날씨. Open-Meteo(키 없음)에서 고정 지역의 오늘 최고·최저와 날씨 코드만 받는다.
// 사용자 데이터가 아니므로 인스턴스 메모리에 30분 둔다. 날짜가 바뀌면 바로 새로 받는다.
const TTL = 30 * 60 * 1000;
let cached: { at: number; value: TodayWeather } | null = null;

export async function todayWeather(): Promise<TodayWeather> {
  const date = today();
  if (cached && cached.value.date === date && Date.now() - cached.at < TTL)
    return cached.value;
  try {
    const value = await fetchToday(date);
    cached = { at: Date.now(), value };
    return value;
  } catch (e) {
    // 잠깐의 실패는 같은 날 값이 있으면 그대로 보여준다.
    if (cached && cached.value.date === date) return cached.value;
    throw e;
  }
}

async function fetchToday(date: string): Promise<TodayWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(weatherPlace.latitude),
    longitude: String(weatherPlace.longitude),
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    timezone: "Asia/Seoul",
    forecast_days: "1",
  }).toString();
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw unavailable();
  const body = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      weather_code?: (number | null)[];
    };
  };
  const max = body.daily?.temperature_2m_max?.[0];
  const min = body.daily?.temperature_2m_min?.[0];
  const code = body.daily?.weather_code?.[0];
  if (
    typeof max !== "number" ||
    typeof min !== "number" ||
    typeof code !== "number"
  )
    throw unavailable();
  return {
    date: body.daily?.time?.[0] ?? date,
    place: weatherPlace.label,
    kind: weatherKind(code),
    min: Math.round(min),
    max: Math.round(max),
    updatedAt: new Date().toISOString(),
  };
}

const unavailable = () =>
  new AppError("WEATHER_UNAVAILABLE", "날씨를 불러오지 못했습니다.", 502);
