import type { BakingRecipe } from "../types";

// 원본 옮김: docs/baking/recipes/lemon-milk-cake.md
export const lemonMilkCake: BakingRecipe = {
  id: "lemon-milk-cake",
  category: "케이크",
  addedAt: "2026-10-17",
  emoji: "🍋",
  name: "레몬우유케이크",
  source: "Merrybonbon Baking Class · 손글씨 메모 포함",
  chips: ["1호 원형틀", "시트 + 레몬커드 + 우유크림"],
  ovens: [
    { what: "시트", temp: 160, min: 25, note: "인쇄본 24분 → 메모 25분" },
  ],
  parts: [
    {
      name: "반죽",
      items: [
        { name: "전란", qty: 120, unit: "g" },
        { name: "설탕", qty: 66, unit: "g", note: "{{따로 계량}}" },
        { name: "꿀", qty: 18, unit: "g" },
        { name: "박력분", qty: 63, unit: "g" },
        { name: "버터", qty: 12, unit: "g", note: "{{우유와 같이 계량}}" },
        { name: "우유", qty: 22, unit: "g", note: "{{버터와 같이 계량}}" },
        { name: "레몬제스트", qty: 1, unit: "g", note: "{{추가}}" },
      ],
      steps: [
        {
          title: "공기포집",
          text: "전란에 설탕·꿀을 넣어 공기포집한다.",
          sub: ["{{믹서 5단으로 걸쭉하게 휘핑 → 이후 1단으로 1분 휘핑}}"],
        },
        { title: "가루", text: "충분히 공기포집되면 가루를 넣고 섞는다." },
        {
          title: "버터·우유",
          text: "데운 버터·우유를 넣고 잘 섞는다.",
          badges: ["버터·우유 40℃"],
          sub: [
            "{{반죽을 조금 덜어 버터·우유에 먼저 섞고, 본 반죽에 넣어 퍼올리듯이}}",
          ],
        },
        {
          title: "굽기",
          text: "틀에 팬닝해 오븐에 굽는다.",
          heat: "160℃ · 25분",
          sub: ["160℃ ~~24분~~ {{25분}}", "{{예열 160℃}}"],
        },
      ],
    },
    {
      name: "레몬커드",
      items: [
        { name: "전란", qty: 64, unit: "g" },
        { name: "설탕", qty: 61, unit: "g" },
        {
          name: "레몬즙",
          qty: 50,
          unit: "g",
          note: "{{생레몬 2개(?), 제스트 2g 추가}}",
        },
        { name: "버터", qty: 20, unit: "g" },
        {
          name: "젤라틴",
          text: "~~1~~ ½",
          note: "생략 가능 · 단위 표기 없음 · {{찬물에 불려 키친타월로 물기 짜기}}",
        },
      ],
      steps: [
        { text: "전란에 설탕·레몬즙을 넣고 가볍게 섞는다." },
        {
          text: "중불에서 알맞은 농도가 될 때까지 끓인다.",
          badges: ["{{80℃}}"],
        },
        { text: "농도가 되면 버터·젤라틴을 넣고 섞어 마무리한다." },
        { text: "체에 내려 차갑게 식혀 쓴다.", badges: ["냉장"] },
      ],
    },
    {
      name: "우유크림",
      items: [
        {
          name: "마스카포네",
          qty: 91,
          unit: "g",
          note: "{{알라(Arla)(?)}}",
        },
        { name: "생크림", qty: 156, unit: "g", note: "{{서울우유}}" },
        { name: "설탕", qty: 20, unit: "g" },
      ],
      steps: [
        {
          text: "모든 재료를 함께 휘핑해 쓴다.",
          sub: ["{{세 재료를 같이 계량해 냉장고에 둔다}}"],
        },
      ],
    },
  ],
  notes: [],
};
