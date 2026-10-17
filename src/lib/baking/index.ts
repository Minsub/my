// 취미 > 베이킹. 레시피 추가: recipes/{id}.ts를 만들고 아래 목록에 한 줄 넣는다.
// 절차는 docs/baking/README.md.
import { financier } from "./recipes/financier";
import { lemonMilkCake } from "./recipes/lemon-milk-cake";
import { walnutCarrotCake } from "./recipes/walnut-carrot-cake";
import type { BakingItem, BakingPart, BakingRecipe } from "./types";

export * from "./types";

const registered: BakingRecipe[] = [financier, lemonMilkCake, walnutCarrotCake];

// 같은 id가 둘이면 링크·접기 기억이 섞인다. 개발 중 바로 보이게 모듈을 읽을 때 멈춘다.
const ids = new Set<string>();
for (const recipe of registered) {
  if (!/^[a-z0-9-]+$/.test(recipe.id) || ids.has(recipe.id))
    throw new Error(`베이킹 레시피 id가 잘못됐거나 겹칩니다: ${recipe.id}`);
  ids.add(recipe.id);
}

/** 최근 추가 순, 같은 날이면 이름 순 */
export const bakingRecipes: readonly BakingRecipe[] = [...registered].sort(
  (a, b) =>
    b.addedAt.localeCompare(a.addedAt) || a.name.localeCompare(b.name, "ko"),
);

export const bakingScales = [0.5, 1, 1.5, 2] as const;

export function findBakingRecipe(id: string | undefined) {
  return bakingRecipes.find((r) => r.id === id);
}

export function itemGrams(item: BakingItem) {
  if (item.qty == null) return 0;
  return item.unit === "g" ? item.qty : (item.grams ?? 0);
}

export function partGrams(part: BakingPart) {
  return part.items.reduce((sum, item) => sum + itemGrams(item), 0);
}

export function recipeGrams(recipe: BakingRecipe) {
  return recipe.parts.reduce((sum, part) => sum + partGrams(part), 0);
}

export function ovenTemps(recipe: BakingRecipe) {
  return [...new Set(recipe.ovens.map((o) => `${o.temp}℃`))];
}

export function formatAmount(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}

// 메모 표기({{ }}, ~~ ~~, (?))를 걷어낸 글자. 검색에 쓴다.
const plain = (text: string) => text.replace(/\{\{|\}\}|~~|\(\?\)/g, "");

/** 이름·분류·출처·재료 이름에서 찾는다. 공백으로 나눈 낱말이 모두 있어야 한다. */
export function matchBakingRecipe(recipe: BakingRecipe, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    recipe.name,
    recipe.category,
    plain(recipe.source),
    ...recipe.parts.flatMap((p) => [p.name, ...p.items.map((i) => i.name)]),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export type CombinedItem = {
  name: string;
  unit?: BakingItem["unit"];
  qty: number;
  grams: number;
  text?: string;
  from: { part: number; qty?: number; grams: number; text?: string }[];
};

// 구성(반죽·커드·크림)에 흩어진 같은 재료를 이름·단위로 묶는다. 숫자가 없는 양은 구성별로 따로 둔다.
export function combinedItems(recipe: BakingRecipe): CombinedItem[] {
  const rows = new Map<string, CombinedItem>();
  recipe.parts.forEach((part, pi) => {
    for (const item of part.items) {
      const key =
        item.qty == null
          ? `${item.name}|text|${pi}`
          : `${item.name}|${item.unit}`;
      const row = rows.get(key) ?? {
        name: item.name,
        unit: item.unit,
        qty: 0,
        grams: 0,
        text: item.text,
        from: [],
      };
      row.qty += item.qty ?? 0;
      row.grams += itemGrams(item);
      row.from.push({
        part: pi,
        qty: item.qty,
        grams: itemGrams(item),
        text: item.text,
      });
      rows.set(key, row);
    }
  });
  return [...rows.values()];
}

/** 접기 대상 상자. 구성이 하나면 전체 재료 상자가 없다. */
export function bakingFoldKeys(recipe: BakingRecipe) {
  return [
    ...(recipe.parts.length > 1 ? ["all"] : []),
    "oven",
    ...recipe.parts.map((_, i) => `part-${i}`),
    ...(recipe.notes.length ? ["notes"] : []),
  ];
}
