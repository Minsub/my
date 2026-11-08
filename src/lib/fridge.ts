// 취미 / 냉장고. 웹·서버가 같이 쓰는 칸·이름 정리·집밥 매칭 기준.
import type { MealDish } from "./meals";

export const fridgePlaces = ["cold", "frozen"] as const;
export type FridgePlace = (typeof fridgePlaces)[number];
export const fridgePlaceLabels: Record<FridgePlace, string> = {
  cold: "냉장실",
  frozen: "냉동실",
};
// 한 번에 넣는 재료 수. 장 본 것을 한 줄로 적는 정도면 충분하다.
export const FRIDGE_MAX_ADD = 20;
export const FRIDGE_NAME_MAX = 40;

export type FridgeItem = {
  id: string;
  name: string;
  place: FridgePlace;
  added_on: string; // YYYY-MM-DD, 서울 날짜
  version: number;
};
export type FridgeState = {
  items: FridgeItem[];
  // 최근에 다 먹은 재료 이름(지금 냉장고에 없는 것만, 최근 순). "다시 넣기" 제안에 쓴다.
  recent: string[];
  // 이번 달(서울) 버린 재료 수
  wasted_this_month: number;
};

// 냉장고에 적지 않지만 늘 있다고 보는 재료. 집밥 매칭에서 "있음"으로 친다.
// 바꾸려면 여기만 고친다.
export const fridgeStaples = [
  "김치",
  "된장",
  "고추장",
  "간장",
  "고춧가루",
  "마늘",
  "참기름",
  "굴소스",
  "두반장",
  "참치",
];

// "두부, 대파\n양파"처럼 적은 입력을 이름 목록으로. 앞뒤 공백·중복을 지운다.
export function splitFridgeNames(text: string) {
  const out: string[] = [];
  for (const raw of text.split(/[,，、\n]/)) {
    const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const nameKey = (s: string) => s.normalize("NFC").replace(/\s+/g, "");

// 집밥 재료 하나에 맞는 냉장고 재료. 이름이 같으면 그대로, 아니면 냉장고 이름이 재료 이름을
// 품을 때 맞춘다("다진 돼지고기" ↔ "돼지고기", "냉동밥" ↔ "밥"). 한 글자 재료("무")는
// "단무지" 같은 엉뚱한 이름에 걸리지 않도록 같은 이름만 맞춘다.
export function findFridgeItem<T extends { name: string }>(
  items: T[],
  ingredient: string,
) {
  const key = nameKey(ingredient);
  return (
    items.find((i) => nameKey(i.name) === key) ??
    (key.length >= 2
      ? items.find((i) => nameKey(i.name).includes(key))
      : undefined)
  );
}

export type MealMatchPart = {
  name: string;
  state: "have" | "frozen" | "staple" | "missing";
  item?: FridgeItem;
};
export type MealMatch = {
  dish: MealDish;
  parts: MealMatchPart[];
  missing: number;
  oldest: number; // 쓰는 냉장고 재료 중 가장 오래 둔 것의 넣은 날(정렬용, 없으면 0)
};

// 집밥 요리를 냉장고 재료로 맞춰 본다. 다 있거나 하나만 없는 요리만 남기고,
// 없는 수가 적은 순 → 오래 둔 재료를 쓰는 순으로 둔다.
export function matchMeals(dishes: MealDish[], items: FridgeItem[]) {
  const staples = new Set(fridgeStaples.map(nameKey));
  const rows: MealMatch[] = dishes.map((dish) => {
    const parts = dish.ingredients.map((name): MealMatchPart => {
      const item = findFridgeItem(items, name);
      if (item)
        return {
          name,
          state: item.place === "frozen" ? "frozen" : "have",
          item,
        };
      if (staples.has(nameKey(name))) return { name, state: "staple" };
      return { name, state: "missing" };
    });
    const used = parts.flatMap((p) => (p.item ? [p.item.added_on] : []));
    return {
      dish,
      parts,
      missing: parts.filter((p) => p.state === "missing").length,
      oldest: used.length ? Date.parse(used.sort()[0]) : 0,
    };
  });
  return rows
    .filter((r) => r.missing <= 1 && r.parts.some((p) => p.item))
    .sort(
      (a, b) =>
        a.missing - b.missing ||
        (a.oldest || Infinity) - (b.oldest || Infinity) ||
        a.dish.title.localeCompare(b.dish.title, "ko"),
    );
}

// 넣은 날 표시: 오늘·어제, 그 밖은 M/D
export function fridgeDayLabel(addedOn: string, todayIso: string) {
  const days = Math.round(
    (Date.parse(todayIso) - Date.parse(addedOn)) / 86400000,
  );
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  const [, m, d] = addedOn.split("-").map(Number);
  return `${m}/${d}`;
}

// 이름으로 고르는 아이콘. 입력받지 않고 이름에 든 낱말로 정한다. 앞에 있을수록 먼저 본다
// ("김치찌개"는 찌개, "양배추"는 배가 아니라 양배추).
const icons: [string, string][] = [
  ["아이스크림", "🍦"],
  ["브로콜리", "🥦"],
  ["방울토마토", "🍅"],
  ["토마토", "🍅"],
  ["양배추", "🥬"],
  ["애호박", "🥒"],
  ["삼겹살", "🥓"],
  ["베이컨", "🥓"],
  ["소시지", "🌭"],
  ["두부", "⬜"],
  ["대파", "🥬"],
  ["쪽파", "🥬"],
  ["양파", "🧅"],
  ["당근", "🥕"],
  ["오이", "🥒"],
  ["호박", "🎃"],
  ["버섯", "🍄"],
  ["상추", "🥬"],
  ["배추", "🥬"],
  ["시금치", "🥬"],
  ["깻잎", "🌿"],
  ["나물", "🥗"],
  ["샐러드", "🥗"],
  ["고추", "🌶️"],
  ["파프리카", "🫑"],
  ["피망", "🫑"],
  ["마늘", "🧄"],
  ["생강", "🫚"],
  ["감자", "🥔"],
  ["고구마", "🍠"],
  ["옥수수", "🌽"],
  ["숙주", "🌱"],
  ["콩나물", "🌱"],
  ["계란", "🥚"],
  ["달걀", "🥚"],
  ["우유", "🥛"],
  ["요거트", "🍶"],
  ["요구르트", "🍶"],
  ["치즈", "🧀"],
  ["버터", "🧈"],
  ["돼지", "🥩"],
  ["소고기", "🥩"],
  ["한우", "🥩"],
  ["고기", "🥩"],
  ["닭", "🍗"],
  ["오리", "🍗"],
  ["새우", "🦐"],
  ["오징어", "🦑"],
  ["문어", "🐙"],
  ["조개", "🦪"],
  ["굴", "🦪"],
  ["게", "🦀"],
  ["고등어", "🐟"],
  ["연어", "🐟"],
  ["생선", "🐟"],
  ["명란", "🫙"],
  ["젓", "🫙"],
  ["찌개", "🍲"],
  ["국", "🍲"],
  ["김치", "🥬"],
  ["카레", "🍛"],
  ["반찬", "🍱"],
  ["만두", "🥟"],
  ["떡", "🍡"],
  ["어묵", "🍢"],
  ["밥", "🍚"],
  ["면", "🍜"],
  ["국수", "🍜"],
  ["빵", "🍞"],
  ["사과", "🍎"],
  ["배", "🍐"],
  ["귤", "🍊"],
  ["오렌지", "🍊"],
  ["레몬", "🍋"],
  ["바나나", "🍌"],
  ["딸기", "🍓"],
  ["포도", "🍇"],
  ["머스캣", "🍇"],
  ["블루베리", "🫐"],
  ["키위", "🥝"],
  ["수박", "🍉"],
  ["복숭아", "🍑"],
  ["무", "🥬"],
];
export function fridgeIcon(name: string) {
  return icons.find(([word]) => name.includes(word))?.[1] ?? "🥡";
}
