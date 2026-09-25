import type { PregnancyData, PregnancyEvent } from "./pregnancy";
// 둘러보기용 예시 기록. 지금 시각을 기준으로 만들어 "최근 1시간" 판정이 보이게 한다.
export function demoPregnancy(now: number): PregnancyData {
  let seq = 0;
  const ev = (
    kind: PregnancyEvent["kind"],
    minutesAgo: number,
    seconds: number,
    extra: Partial<PregnancyEvent> = {},
  ): PregnancyEvent => {
    const start = now - minutesAgo * 60000;
    return {
      id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
      kind,
      started_at: new Date(start).toISOString(),
      ended_at:
        kind === "bleeding"
          ? null
          : new Date(start + seconds * 1000).toISOString(),
      intensity: null,
      bleeding: null,
      bleeding_color: null,
      memo: "",
      version: 1,
      created_by: "demo",
      created_by_name: "둘러보기",
      photo_ids: [],
      can_edit: false,
      ...extra,
    };
  };
  const due = new Date(now + 56 * 86400000);
  return {
    settings: {
      due_date: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
      version: 1,
    },
    events: [
      ev("tightening", 26 * 60 + 10, 22),
      ev("tightening", 25 * 60 + 40, 18),
      ev("pain", 25 * 60 + 20, 50, { intensity: 1 }),
      ev("tightening", 9 * 60 + 5, 20),
      ev("bleeding", 8 * 60, 0, { bleeding: "none", memo: "배뭉침 뒤 확인" }),
      ev("tightening", 6 * 60 + 30, 34, { intensity: 1 }),
      ev("bleeding", 5 * 60 + 40, 0, {
        bleeding: "spotting",
        bleeding_color: "brown",
        memo: "화장실에서 확인",
      }),
      ev("tightening", 168, 28),
      ev("tightening", 150, 31),
      ev("pain", 140, 55, { intensity: 2 }),
      ev("tightening", 131, 24),
      ev("tightening", 112, 40, { intensity: 2 }),
      ev("tightening", 96, 36),
      ev("pain", 90, 62, { intensity: 2, memo: "허리 쪽 묵직함" }),
      ev("tightening", 52, 44, { intensity: 2 }),
      ev("pain", 51.8, 35, { intensity: 1, memo: "배뭉침 중 아랫배 콕콕" }),
      ev("pain", 45, 70, { intensity: 3 }),
      ev("tightening", 38, 47, { intensity: 2 }),
      ev("tightening", 27, 52, { intensity: 2 }),
      ev("tightening", 15, 49, { intensity: 3 }),
      ev("tightening", 6, 41, { intensity: 2 }),
    ].sort((a, b) => b.started_at.localeCompare(a.started_at)),
  };
}
