import type { Bean, BeanPrice, Preference } from "./types";
export const COFFEE_MAX_PRICES = 10;
// 목록·정렬의 대표 옵션은 가장 비싼 옵션이다. 가격이 같으면 중량이 큰 쪽, 가격이 없으면 첫 줄.
export function mainPrice(bean: Pick<Bean, "prices">): BeanPrice | null {
  let best: BeanPrice | null = null;
  for (const p of bean.prices) {
    if (!best) best = p;
    else if (p.price !== null && (best.price === null || p.price > best.price))
      best = p;
    else if (
      p.price !== null &&
      p.price === best.price &&
      (p.weight_g ?? 0) > (best.weight_g ?? 0)
    )
      best = p;
  }
  return best;
}
export const weightLabel = (g: number | null) =>
  g == null
    ? "중량 미입력"
    : g >= 1000 && g % 1000 === 0
      ? `${g / 1000}kg`
      : `${g}g`;
// 경험은 저장하지 않고 취향 기록으로 정한다. 기록이 있으면 먹어봄, 없으면 구매예정.
export type CoffeeStatus = "구매예정" | "먹어봄";
export const beanStatus = (
  beanId: string,
  preferences: Pick<Preference, "bean_id">[],
): CoffeeStatus =>
  preferences.some((p) => p.bean_id === beanId) ? "먹어봄" : "구매예정";
