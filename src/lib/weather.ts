// 시계 화면의 날씨. 지역은 한 곳으로 고정하고, 상태는 맑음·흐림·비·눈 네 가지로만 묶는다.
// 날씨앱의 시간별 예보처럼 오늘 0~23시 값을 받아 두고, 화면이 지금 시각의 칸을 골라 쓴다.
export const weatherPlace = {
  label: "용인 수지",
  latitude: 37.3222,
  longitude: 127.0975,
};

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export type WeatherHour = {
  hour: number; // 0~23, Asia/Seoul
  temp: number; // °C, 반올림
  kind: WeatherKind;
  isDay: boolean;
};

export type TodayWeather = {
  date: string; // Asia/Seoul YYYY-MM-DD
  place: string;
  hours: WeatherHour[];
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

// 지금 시각의 칸. 없으면 가장 가까운 앞 시간을 쓴다.
export function weatherAt(weather: TodayWeather, hour: number) {
  let pick: WeatherHour | undefined;
  for (const h of weather.hours) if (h.hour <= hour) pick = h;
  return pick ?? weather.hours[0];
}

export const demoWeather = (date: string): TodayWeather => ({
  date,
  place: weatherPlace.label,
  hours: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    temp: Math.round(9.5 - 5.5 * Math.cos(((hour - 3) / 24) * 2 * Math.PI)),
    kind: hour >= 15 && hour < 19 ? "cloudy" : "clear",
    isDay: hour >= 7 && hour < 18,
  })),
  min: 4,
  max: 15,
  updatedAt: new Date().toISOString(),
});
