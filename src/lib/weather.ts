// 시계 화면의 오늘 날씨. 지역은 한 곳으로 고정하고, 상태는 맑음·흐림·비·눈 네 가지로만 묶는다.
export const weatherPlace = {
  label: "용인 수지",
  latitude: 37.3222,
  longitude: 127.0975,
};

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export type TodayWeather = {
  date: string; // Asia/Seoul YYYY-MM-DD
  place: string;
  kind: WeatherKind;
  min: number; // °C, 반올림
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
  kind: "clear",
  min: 4,
  max: 15,
  updatedAt: new Date().toISOString(),
});
