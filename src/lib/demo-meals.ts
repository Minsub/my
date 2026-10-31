// /demo의 집밥 화면에 보이는 예시 요리. 실제 DB 데이터가 아니다.
import type { MealDish } from "./meals";

const base = {
  version: 1,
  created_by: "demo-user",
  created_by_name: "둘러보기",
  updated_at: "2026-10-30T09:00:00.000Z",
};
const dish = (
  id: number,
  title: string,
  category: string,
  ingredients: string[],
  tags: string[],
  extra: Partial<MealDish> = {},
): MealDish => ({
  ...base,
  id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  title,
  category,
  ingredients,
  tags,
  links: [],
  memo: "",
  want_to_try: false,
  created_at: new Date(Date.UTC(2026, 9, 30 - id, 9)).toISOString(),
  ...extra,
});
export const demoMeals: MealDish[] = [
  dish(1, "참치김치찌개", "한식", ["김치", "두부", "참치"], ["매움", "국물"], {
    memo: "참치는 기름 빼고 넣기. 김치는 충분히 볶는다.",
  }),
  dish(2, "팟타이", "아시안", ["쌀국수", "새우", "숙주"], ["면"], {
    want_to_try: true,
    links: ["https://www.10000recipe.com/recipe/6835201"],
  }),
  dish(3, "된장찌개", "한식", ["된장", "두부", "애호박"], ["국물"]),
  dish(4, "알리오올리오", "양식", ["마늘", "파스타면"], ["면", "간단"], {
    links: ["https://blog.example.com/aglio-olio"],
  }),
  dish(5, "김치볶음밥", "한식", ["김치", "밥", "계란"], ["간단"]),
  dish(6, "감바스", "양식", ["새우", "마늘"], ["손님상"], {
    want_to_try: true,
  }),
  dish(7, "마파두부", "중식", ["두부", "돼지고기", "두반장"], ["매움"]),
  dish(8, "오야코동", "일식", ["닭고기", "계란", "양파"], ["덮밥"]),
  dish(9, "떡볶이", "분식", ["떡", "어묵"], ["매움", "간단"]),
];
