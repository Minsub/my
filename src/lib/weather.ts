// 시계 화면의 날씨. 지역은 한 곳으로 고정하고, 상태는 맑음·흐림·비·눈 네 가지로만 묶는다.
// 상태와 현재 기온은 지금 시각 기준, 최저·최고는 오늘 하루 기준이다.
export const weatherPlace = {
  label: "용인 수지",
  latitude: 37.3222,
  longitude: 127.0975,
};

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export type TodayWeather = {
  date: string; // Asia/Seoul YYYY-MM-DD
  place: string;
  now: { temp: number; kind: WeatherKind; isDay: boolean }; // °C, 반올림
  min: number;
  max: number;
  updatedAt: string;
};

export const weatherLabel: Record<WeatherKind, string> = {
  clear: "맑음",
  cloudy: "흐림",
  rain: "비",
  snow: "눈",
};

// Open-Meteo가 주는 WMO 날씨 코드를 네 가지로 묶는다. 0·1 맑음, 2·3·안개 흐림, 눈 계열 눈, 나머지 강수는 비.
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return "clear";
  if (code <= 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}

export const demoWeather = (date: string): TodayWeather => ({
  date,
  place: weatherPlace.label,
  now: { temp: 9, kind: "clear", isDay: true },
  min: 4,
  max: 15,
  updatedAt: new Date().toISOString(),
});
