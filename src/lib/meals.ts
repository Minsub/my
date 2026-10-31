// 취미 / 집밥. 웹·서버·MCP가 같이 쓰는 카테고리·정규화·필터 기준.

// 칩 순서이자 입력 허용 목록이다. 바꾸려면 여기만 고친다(SQL CHECK 없음).
export const mealCategories = [
  "한식",
  "양식",
  "중식",
  "일식",
  "아시안",
  "분식",
  "기타",
] as const;
export type MealCategory = (typeof mealCategories)[number];
export const MEAL_MAX_LINKS = 10;
export const MEAL_MAX_INGREDIENTS = 30;
export const MEAL_MAX_TAGS = 20;

export type MealDish = {
  id: string;
  title: string;
  category: string;
  ingredients: string[];
  tags: string[];
  links: string[];
  memo: string;
  want_to_try: boolean;
  version: number;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// 같은 요리 판단 키. 띄어쓰기·대소문자만 무시한다.
export function mealTitleKey(title: string) {
  return title.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

// 재료·태그 목록 정리: 앞뒤 공백·"#" 제거, 빈 값·중복 제거, 입력 순서 유지.
export function cleanMealWords(words: string[]) {
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.normalize("NFC").replace(/^#+/, "").trim();
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

// "두부, 김치, 참치"처럼 쉼표로 적은 입력을 목록으로 바꾼다.
export function splitMealWords(text: string) {
  return cleanMealWords(text.split(/[,，、\n]/));
}

export type MealFilters = {
  q?: string;
  category?: string;
  tags?: string[];
  ingredient?: string;
  want?: boolean;
};

// 검색어는 공백으로 나눈 낱말이 모두 이름·재료·태그·메모 어딘가에 있어야 한다.
// 태그는 고른 것을 모두 가진 요리만, 재료는 그 재료가 들어간 요리만 남긴다.
export function filterMeals(dishes: MealDish[], f: MealFilters) {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const tags = f.tags ?? [];
  const ingredient = f.ingredient?.trim();
  return dishes.filter((d) => {
    if (f.category && d.category !== f.category) return false;
    if (f.want && !d.want_to_try) return false;
    if (tags.some((t) => !d.tags.includes(t))) return false;
    if (ingredient && !d.ingredients.some((i) => i.includes(ingredient)))
      return false;
    if (!words.length) return true;
    const hay = [d.title, ...d.ingredients, ...d.tags, d.memo]
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// 많이 쓴 순서(같으면 가나다)로 재료·태그 이름과 쓰인 횟수를 센다. 입력 제안과 칩에 쓴다.
export function mealWordCounts(
  dishes: MealDish[],
  key: "ingredients" | "tags",
) {
  const counts = new Map<string, number>();
  for (const d of dishes)
    for (const w of d[key]) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

export function youtubeId(link: string) {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
        id = m?.[2] ?? null;
      }
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function linkHost(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

// 링크 미리보기 응답. 이미지·제목은 없을 수 있다.
export type LinkPreview = {
  url: string;
  title: string | null;
  image: string | null;
  site: string;
};
