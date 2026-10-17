// 취미 > 베이킹 레시피 형식. DB 없이 recipes/ 아래 정적 파일로 둔다.
// 문자열 안의 {{...}}는 손글씨 메모, ~~...~~는 지운 값, (?)는 사진으로 읽기 어려운 글자다.

/** 목록의 분류 칩 순서. 레시피가 하나도 없는 분류는 칩을 그리지 않는다. */
export const bakingCategories = [
  "케이크",
  "구움과자",
  "쿠키",
  "타르트·파이",
  "빵",
  "디저트",
] as const;
export type BakingCategory = (typeof bakingCategories)[number];

export type BakingItem = {
  name: string;
  /** 숫자 양. 없으면 text를 그대로 보인다(한 꼬집 등). 배율에 맞춰 곱한다. */
  qty?: number;
  unit?: "g" | "ml" | "개";
  text?: string;
  /** 무게 막대·합계용 g 환산값. unit이 g가 아닐 때만 쓴다. */
  grams?: number;
  note?: string;
};

export type BakingStep = {
  title?: string;
  text: string;
  /** 오븐 칩. 예: "170℃ · 40분" */
  heat?: string;
  badges?: string[];
  sub?: string[];
};

/** 반죽·커드·크림처럼 따로 계량하고 만드는 한 덩어리. */
export type BakingPart = {
  name: string;
  items: BakingItem[];
  steps: BakingStep[];
  notes?: string[];
};

export type BakingOven = {
  what: string;
  temp: number;
  min: number;
  /** 7~8분처럼 범위일 때 끝 값 */
  max?: number;
  note?: string;
};

export type BakingRecipe = {
  /** URL 조각(/hobby/baking/{id}). 영문 소문자·숫자·하이픈. 바꾸면 기존 링크와 접기 기억이 끊긴다. */
  id: string;
  category: BakingCategory;
  /** 목록 정렬용 추가일 YYYY-MM-DD */
  addedAt: string;
  emoji: string;
  name: string;
  source: string;
  /** 틀·분량·구성·보관처럼 한눈에 볼 요약 */
  chips: string[];
  ovens: BakingOven[];
  parts: BakingPart[];
  /** 레시피 전체 메모·보관 */
  notes: string[];
};
