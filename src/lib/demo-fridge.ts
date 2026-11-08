// /demo의 냉장고 화면에 보이는 예시 재료. 실제 DB 데이터가 아니다.
// 넣은 날은 오늘 기준 며칠 전으로 만들어 언제 열어도 비슷하게 보인다.
import { today } from "./format";
import { guessFridgeKind, type FridgePlace, type FridgeState } from "./fridge";

const sample: [string, FridgePlace, number][] = [
  ["두부", "cold", 4],
  ["대파", "cold", 5],
  ["양파", "cold", 2],
  ["당근", "cold", 8],
  ["오이", "cold", 6],
  ["표고버섯", "cold", 6],
  ["애호박", "cold", 1],
  ["계란", "cold", 4],
  ["우유", "cold", 3],
  ["돼지고기", "cold", 2],
  ["닭고기", "cold", 1],
  ["시금치나물", "cold", 3],
  ["김치찌개 남은 것", "cold", 2],
  ["감자조림", "cold", 3],
  ["도라지무침", "cold", 5],
  ["방울토마토", "cold", 4],
  ["요거트", "cold", 5],
  ["청양고추", "cold", 10],
  ["냉동밥", "frozen", 6],
  ["만두", "frozen", 30],
  ["새우", "frozen", 40],
  ["고등어", "frozen", 55],
  ["소고기 국거리", "frozen", 80],
  ["떡", "frozen", 21],
  ["식빵", "frozen", 14],
  ["아이스크림", "frozen", 20],
  ["냉동 짬뽕", "frozen", 9],
];

export function demoFridge(): FridgeState {
  const base = Date.parse(today());
  return {
    items: sample.map(([name, place, ago], i) => ({
      id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, "0")}`,
      name,
      place,
      kind: guessFridgeKind(name),
      added_on: new Date(base - ago * 86400000).toISOString().slice(0, 10),
      version: 1,
    })),
    frequent: [
      { name: "콩나물", kind: "ingredient", place: "cold" },
      { name: "숙주", kind: "ingredient", place: "cold" },
      { name: "상추", kind: "ingredient", place: "cold" },
      { name: "삼겹살", kind: "ingredient", place: "frozen" },
      { name: "멸치볶음", kind: "dish", place: "cold" },
      { name: "냉동 피자", kind: "ready", place: "frozen" },
    ],
    wasted_this_month: 1,
  };
}
