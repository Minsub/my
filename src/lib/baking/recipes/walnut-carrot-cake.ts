import type { BakingRecipe } from "../types";

// 원본 옮김: docs/baking/recipes/walnut-carrot-cake.md
export const walnutCarrotCake: BakingRecipe = {
  id: "walnut-carrot-cake",
  category: "케이크",
  addedAt: "2026-10-17",
  emoji: "🥕",
  name: "호두당근케이크",
  source: "Merrybonbon Baking Class · 손글씨 메모 포함",
  chips: [
    "원형팬 2개 (1/3 · 2/3)",
    "시트 + 크림치즈크림 + 크럼블",
    "시트 냉동 1달 · 실온 2일",
  ],
  ovens: [
    { what: "호두 전처리", temp: 170, min: 7, max: 8 },
    { what: "시트 (1/3 반죽)", temp: 170, min: 40 },
    { what: "시트 (2/3 반죽)", temp: 170, min: 50 },
    { what: "크럼블", temp: 170, min: 20 },
  ],
  parts: [
    {
      name: "당근시트",
      items: [
        {
          name: "계란",
          qty: 3,
          unit: "개",
          grams: 180,
          note: "{{특란, 개당 60g~}}",
        },
        {
          name: "흑설탕",
          qty: 210,
          unit: "g",
          note: "{{180g까지 줄여도 됨}}",
        },
        {
          name: "카놀라유",
          qty: 220,
          unit: "g",
          note: "{{포도씨유 가능 / 올리브유 ✕}}",
        },
        { name: "중력분", qty: 255, unit: "g", note: "체 침" },
        { name: "베이킹파우더", qty: 3, unit: "g", note: "{{↑ 위로 부풂}}" },
        {
          name: "베이킹소다",
          qty: 3,
          unit: "g",
          note: "{{← → 옆으로 퍼짐}}",
        },
        {
          name: "시나몬파우더",
          qty: 4,
          unit: "g",
          note: "{{기호에 따라 넣거나 빼도 됨(?)}}",
        },
        { name: "채썬 당근", qty: 180, unit: "g", note: "{{채칼}}" },
        {
          name: "구운 호두",
          qty: 40,
          unit: "g",
          note: "{{끓는 물 1분 데쳐 불순물 제거 → 170℃ 7~8분 굽기}}",
        },
      ],
      steps: [
        {
          title: "호두 준비",
          text: "{{끓는 물에 1분 데쳐 불순물 제거 후 오븐에 굽는다.}}",
          heat: "170℃ · 7~8분",
        },
        { text: "계란·흑설탕을 넣고 풀어준다." },
        { text: "카놀라유를 넣고 섞는다." },
        {
          text: "체 친 중력분·베이킹파우더·베이킹소다·시나몬파우더(가루류 모두)를 넣고 섞는다.",
        },
        {
          text: "토핑(당근·호두)을 넣고 날가루가 없어질 때까지만 섞는다.",
        },
        { text: "유산지를 깐 원형팬에 반죽을 1/3, 2/3씩 나눠 담는다." },
        {
          title: "굽기",
          text: "170℃로 예열한 오븐에서 굽는다.",
          heat: "170℃ · 40분 / 50분",
          sub: [
            "{{1/3 반죽 팬 → 40분, 2/3 반죽 팬 → 50분}}",
            "{{오븐에서 바로 꺼내기}}",
          ],
        },
      ],
    },
    {
      name: "크림치즈크림",
      items: [
        {
          name: "크림치즈",
          qty: 200,
          unit: "g",
          note: "{{필라델피아, 차갑게}}",
        },
        { name: "슈가파우더", qty: 80, unit: "g" },
        { name: "생크림", qty: 170, unit: "g", note: "{{동물성, 차갑게}}" },
      ],
      steps: [
        {
          text: "크림치즈와 슈가파우더를 먼저 부드럽게 휘핑한다.",
          badges: ["{{고속}}"],
        },
        {
          text: "생크림을 여러 번에 나누어 넣으며 휘핑한다.",
          badges: ["{{깍지 804}}"],
        },
      ],
      notes: ["{{냉동 가능. 해동은 실온에서 키친타월 위에 올려두기}}"],
    },
    {
      name: "크럼블",
      items: [
        { name: "아몬드가루", qty: 30, unit: "g" },
        { name: "박력분", qty: 30, unit: "g" },
        { name: "버터", qty: 30, unit: "g", note: "{{앵커, 실온(?)}}" },
        { name: "설탕", qty: 20, unit: "g", note: "{{백설탕·갈색설탕}}" },
      ],
      steps: [
        { text: "모든 재료를 볼에 넣고 가루를 소보로 형태로 뭉친다." },
        { title: "굽기", text: "오븐에 굽는다.", heat: "170℃ · 20분" },
      ],
    },
  ],
  notes: ["{{시트는 냉동 1달 / 실온 2일 보관 가능}}"],
};
