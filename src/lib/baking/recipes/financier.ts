import type { BakingRecipe } from "../types";

// 원본 옮김: docs/baking/recipes/financier.md
export const financier: BakingRecipe = {
  id: "financier",
  category: "구움과자",
  addedAt: "2026-10-17",
  emoji: "🧈",
  name: "휘낭시에",
  source: "YouTube 영상 설명란",
  chips: ["오발틀 12개", "보관 실온 5일 · 냉동"],
  ovens: [
    { what: "휘낭시에", temp: 190, min: 12, note: "예열 · 우녹스 컨벡션" },
  ],
  parts: [
    {
      name: "반죽",
      items: [
        {
          name: "태운 버터",
          qty: 102,
          unit: "g",
          note: "생버터 127g 계량 → 태우면 약 20% 줄어듦",
        },
        { name: "흰자", qty: 110, unit: "g" },
        { name: "설탕", qty: 102, unit: "g" },
        { name: "꿀", qty: 17, unit: "g" },
        { name: "아몬드가루", qty: 46, unit: "g", note: "체 침" },
        { name: "강력분", qty: 22, unit: "g", note: "체 침" },
        { name: "박력분", qty: 22, unit: "g", note: "체 침" },
        { name: "소금", text: "한 꼬집" },
      ],
      steps: [
        {
          title: "헤이즐넛 버터",
          text: "냄비에 실온 버터를 넣고 가열해 갈색 버터를 만든다. 쓰기 전까지 잠시 둔다.",
        },
        {
          title: "흰자 섞기",
          text: "흰자에 설탕·꿀·소금을 넣고 잔거품이 일 때까지 거품기로 가볍게 섞는다.",
        },
        {
          title: "가루 넣기",
          text: "아몬드가루·강력분·박력분을 체 쳐 넣고 가루가 안 보일 때까지 섞는다.",
        },
        {
          title: "버터 넣기",
          text: "헤이즐넛 버터를 넣고 겉돌지 않게 완전히 섞는다.",
          badges: ["버터 60℃ 전후"],
        },
        {
          title: "굽기",
          text: "틀에 80~90% 채우고 예열한 오븐에서 굽는다.",
          heat: "190℃ · 12분",
        },
      ],
    },
  ],
  notes: [
    "버터에는 약 18%의 수분이 있어 태우는 동안 증발하며 무게가 준다.",
    "당일엔 겉이 바삭하다. 완전히 식혀 밀폐해 두면 수분이 돌아 겉과 속이 모두 촉촉해진다.",
    "서늘한 실온 5일. 오래 두려면 잘 포장해 냉동.",
  ],
};
