import { AppError } from "./security";
import { today } from "@/lib/format";
import { weatherKind, weatherPlace, type TodayWeather } from "@/lib/weather";

// 시계 화면용 날씨. Open-Meteo(키 없음)에서 고정 지역의 지금 기온·날씨 코드와 오늘 최고·최저를 받는다.
// 사용자 데이터가 아니므로 인스턴스 메모리에 15분 둔다(Open-Meteo의 현재 값 갱신 간격). 날짜가 바뀌면 바로 새로 받는다.
const TTL = 15 * 60 * 1000;
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
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Seoul",
    forecast_days: "1",
  }).toString();
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw unavailable();
  const body = (await res.json()) as {
    current?: {
      temperature_2m?: number | null;
      weather_code?: number | null;
      is_day?: number | null;
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
    };
  };
  const temp = body.current?.temperature_2m;
  const code = body.current?.weather_code;
  const max = body.daily?.temperature_2m_max?.[0];
  const min = body.daily?.temperature_2m_min?.[0];
  if (
    typeof temp !== "number" ||
    typeof code !== "number" ||
    typeof max !== "number" ||
    typeof min !== "number"
  )
    throw unavailable();
  return {
    date: body.daily?.time?.[0] ?? date,
    place: weatherPlace.label,
    now: {
      temp: Math.round(temp),
      kind: weatherKind(code),
      isDay: body.current?.is_day !== 0,
    },
    min: Math.round(min),
    max: Math.round(max),
    updatedAt: new Date().toISOString(),
  };
}

const unavailable = () =>
  new AppError("WEATHER_UNAVAILABLE", "날씨를 불러오지 못했습니다.", 502);
