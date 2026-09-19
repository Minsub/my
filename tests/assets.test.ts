import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  assetGroups,
  assetRules,
  classifyAsset,
  findAssetGroup,
  buildAssetTimeline,
  buildAssetSummary,
  axisBucketOf,
  assetCagr,
  periodRange,
  periodLabel,
  sliceTimeline,
  assetItemsCsv,
  assetClassificationRules,
  type AssetLinePoint,
} from "../src/lib/assets";
import { demoAssetPlan } from "../src/lib/demo-assets";

// 실제 증권사 화면에서 뽑은 샘플이다. 룰을 고치면 이 표가 먼저 깨져야 한다.
const sample = readFileSync(
  "docs/assert-management/sample_raw_data2.csv",
  "utf8",
)
  .replace(/^﻿/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [name, broker, amount] = line.split(",");
    return { name: name.trim(), broker: broker.trim(), amount: Number(amount) };
  });

// 규칙이 확정하는 금융상품과 국내 ETF. 개별 종목명은 상장 거래소를 알아야 하므로 규칙이 답하지 않는다.
const expected: Record<string, string> = {
  "금 99.99_1kg": "gold",
  "CMA RP": "cash",
  "퍼스트 발행어음 적립(정액)": "deposit",
  "한국투자 IMA S1": "deposit",
  "퍼스트 외화 발행어음 약정(USD)": "usd_note_rp",
  "외화RP(USD)(개인 기간형)": "usd_note_rp",
  "외화RP(USD)자동매매(개인)": "usd_note_rp",
  "퍼스트 발행어음 특판(e)": "krw_note_rp",
  "ISA특판RP(e)-24시간": "krw_note_rp",
  "미국 국채": "foreign_bond",
  "T 0.5 08/31/27": "foreign_bond",
  "T 0.375 09/30/27": "foreign_bond",
  "T 0.375 07/31/27": "foreign_bond",
  "한국투자캐피탈131-2": "kr_bond",
  "한국캐피탈550-2": "kr_bond",
  "주택금융공사MBS2019-18(1-5)(사)": "kr_bond",
  "KODEX 27-12 회사채(AA-이상)액티브": "kr_bond",
  "ACE 미국배당다우존스": "kr_listed_foreign_equity",
  "RISE 미국나스닥100": "kr_listed_foreign_equity",
  "RISE 미국S&P500": "kr_listed_foreign_equity",
  "TIGER 미국S&P500": "kr_listed_foreign_equity",
  "SOL 금융지주플러스고배당": "kr_stock",
  "KODEX 은행": "kr_stock",
  "KODEX 증권": "kr_stock",
  "KODEX 200": "kr_stock",
  "TIGER 반도체": "kr_stock",
  "RISE 200": "kr_stock",
  "RISE TDF2050액티브 적격": "kr_stock",
  "INVESCO NASDAQ 100": "foreign_equity",
  "SCHWAB US DIVIDEND EQUITY": "foreign_equity",
  "VANGUARD S&P 500": "foreign_equity",
  "STATE STREET SPDR PORTFOLIO S&P 500": "foreign_equity",
  "iShares Global Clean Energy ETF": "foreign_equity",
  삼성전자: "unclassified",
  한국금융지주우: "unclassified",
  한국금융지주: "unclassified",
  카카오: "unclassified",
  SK텔레콤: "unclassified",
  신한지주: "unclassified",
  SK스퀘어: "unclassified",
  NAVER: "unclassified",
  현대차2우B: "unclassified",
  코카콜라: "unclassified",
  "알파벳 A": "unclassified",
  "넥스트에라 에너지": "unclassified",
  "제이피모간 체이스": "unclassified",
  "월트 디즈니": "unclassified",
};

describe("자산 그룹 카탈로그와 룰", () => {
  it("샘플 52행을 읽는다", () => {
    expect(sample).toHaveLength(52);
    expect(sample.reduce((n, r) => n + r.amount, 0)).toBe(470914060);
  });
  it("모든 룰의 그룹이 카탈로그에 있고 우선순위가 겹치지 않는다", () => {
    const priorities = assetRules.map((r) => r.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
    for (const rule of assetRules) {
      expect(findAssetGroup(rule.group), rule.group).toBeTruthy();
      for (const pattern of [...rule.any_of, ...(rule.all_of ?? [])])
        expect(() => new RegExp(pattern, "i")).not.toThrow();
    }
  });
  it("모든 그룹에 상위그룹이 있다", () => {
    for (const group of assetGroups)
      expect(group.parent, group.key).toBeTruthy();
    expect(findAssetGroup("kr_stock")!.parent).toBe("주식(원화)");
    expect(findAssetGroup("foreign_equity")!.parent).toBe("주식(달러)");
    expect(findAssetGroup("kr_listed_foreign_equity")!.parent).toBe(
      "주식(달러)",
    );
    expect(findAssetGroup("deposit")!.parent).toBe("상품(원화)");
    expect(findAssetGroup("gold")!.parent).toBe("금");
  });
  it("그룹 key가 중복되지 않고 미분류만 위험 구분이 없다", () => {
    const keys = assetGroups.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const group of assetGroups)
      expect(group.risk === null, group.key).toBe(group.key === "unclassified");
  });
  it("샘플 전 행을 기대한 그룹으로 분류한다", () => {
    for (const row of sample)
      expect(classifyAsset(row.name).group_key, row.name).toBe(
        expected[row.name],
      );
  });
  it("규칙이 확정한 행은 금액의 69.5%를 덮고 나머지는 미분류로 남긴다", () => {
    const unresolved = sample
      .filter((r) => classifyAsset(r.name).needs_review)
      .reduce((n, r) => n + r.amount, 0);
    expect(unresolved).toBe(143707681);
    expect(
      sample.filter((r) => classifyAsset(r.name).needs_review),
    ).toHaveLength(14);
  });
  it("여러 규칙이 동시에 맞는 값을 우선순위로 가른다", () => {
    // 적립식 발행어음은 발행어음/RP가 아니다.
    expect(classifyAsset("퍼스트 발행어음 적립(정액)").group_key).toBe(
      "deposit",
    );
    // 외화 표시 발행어음은 원화 그룹으로 가지 않는다.
    expect(classifyAsset("퍼스트 외화 발행어음 약정(USD)").group_key).toBe(
      "usd_note_rp",
    );
    // CMA RP는 RP를 포함하지만 현금이다.
    expect(classifyAsset("CMA RP").group_key).toBe("cash");
    // 미국 국채가 미국 ETF 규칙에 걸리면 안전자산이 위험자산으로 뒤집힌다.
    expect(classifyAsset("미국 국채").group_key).toBe("foreign_bond");
    // 채권형 ETF는 자산 성격을 따른다.
    expect(classifyAsset("KODEX 27-12 회사채(AA-이상)액티브").group_key).toBe(
      "kr_bond",
    );
  });
  it("이름이 비슷한 값을 잘못 가져가지 않는다", () => {
    expect(classifyAsset("SOL 금융지주플러스고배당").group_key).toBe(
      "kr_stock",
    );
    expect(classifyAsset("금융채").group_key).not.toBe("gold");
    // 한 단어짜리 영문 국내 종목을 해외주식으로 넘기지 않는다.
    expect(classifyAsset("NAVER").group_key).toBe("unclassified");
    expect(classifyAsset("KODEX 200").group_key).toBe("kr_stock");
  });
  it("계좌 밖 자산과 현금성 자산을 규칙으로 확정한다", () => {
    // 계좌 밖 자산은 이름이 한 단어로 들어온다. 규칙이 답하지 않으면 매번 AI 판단에 맡겨진다.
    expect(classifyAsset("예금").group_key).toBe("deposit");
    expect(classifyAsset("현금").group_key).toBe("cash");
    expect(classifyAsset("예적금").group_key).toBe("deposit");
    // MMF·현금성자산은 현금성으로 본다.
    expect(classifyAsset("한국투자증권 현금성자산").group_key).toBe("cash");
    expect(classifyAsset("삼성신종종류형MMF제4호-CP").group_key).toBe("cash");
    // 앵커를 걸었으므로 기존 예금 계열을 흔들지 않는다.
    expect(classifyAsset("정기예금 12개월").group_key).toBe("deposit");
    expect(classifyAsset("예수금").group_key).toBe("cash");
    // 이름에 현금이 들어가도 현금성이 아니면 가져가지 않는다.
    expect(classifyAsset("현금흐름개선 2호").group_key).not.toBe("cash");
  });
  it("룰 응답이 종목 단위 저장을 지시한다", () => {
    const text = assetClassificationRules().instructions.join(" ");
    // 007에서 그룹 합계 테이블을 버렸다. 합산하라는 안내가 남으면 그룹명이 종목명 자리에 들어간다.
    expect(text).not.toContain("lines");
    expect(text).toContain("원본 한 행이 items 한 개다");
    expect(text).toContain("합산하지 않는다");
    expect(assetClassificationRules().write_contract.items).toContain("name");
  });
  it("룰 응답이 AI가 쓰는 항목을 모두 담는다", () => {
    const payload = assetClassificationRules();
    expect(payload.amount_unit).toBe("KRW");
    expect(payload.fallback.group).toBe("unclassified");
    expect(payload.groups.length).toBe(assetGroups.length);
    expect(payload.rules.length).toBe(assetRules.length);
    expect(payload.instructions.join(" ")).toContain("unclassified");
  });
});

const line = (
  as_of: string,
  owner_id: string,
  group_key: string,
  amount: number,
): AssetLinePoint => ({ as_of, owner_id, group_key, amount });

describe("자산 집계", () => {
  const points = [
    line("2026-01-31", "a", "kr_stock", 1000),
    line("2026-01-31", "a", "cash", 1000),
    line("2026-02-28", "b", "foreign_equity", 4000),
    line("2026-03-31", "a", "kr_stock", 3000),
    line("2026-03-31", "a", "cash", 1000),
  ];
  it("기록이 없는 달도 축에 남겨 선이 끊기지 않게 한다", () => {
    expect(periodRange("2025-11", "2026-02", "month")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(periodRange("2024", "2026", "year")).toEqual([
      "2024",
      "2025",
      "2026",
    ]);
    expect(periodLabel("2026-09")).toBe("2026/09");
    expect(periodLabel("2026")).toBe("2026년");
  });
  it("소유자마다 기록한 달이 달라도 직전 기록을 이어서 합산한다", () => {
    const timeline = buildAssetTimeline(points, ["a", "b"], "group", "month");
    expect(timeline.map((p) => p.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(timeline[0].total).toBe(2000);
    expect(timeline[1].total).toBe(6000);
    expect(timeline[1].carried).toEqual(["a"]);
    expect(timeline[2].total).toBe(8000);
    expect(timeline[2].carried).toEqual(["b"]);
  });
  it("한 기간에 기록이 여러 건이면 그 기간의 최신 기록을 쓴다", () => {
    const timeline = buildAssetTimeline(
      [
        line("2026-01-05", "a", "cash", 100),
        line("2026-01-20", "a", "cash", 500),
        line("2026-02-10", "a", "cash", 700),
      ],
      ["a"],
      "group",
      "month",
    );
    expect(timeline.map((p) => p.total)).toEqual([500, 700]);
    expect(timeline[0].as_of).toBe("2026-01-20");
  });
  it("연별로 보면 그 해의 마지막 기록만 남는다", () => {
    const timeline = buildAssetTimeline(
      [
        line("2025-03-31", "a", "cash", 100),
        line("2025-12-31", "a", "cash", 300),
        line("2026-06-30", "a", "cash", 900),
      ],
      ["a"],
      "group",
      "year",
    );
    expect(timeline.map((p) => p.period)).toEqual(["2025", "2026"]);
    expect(timeline.map((p) => p.total)).toEqual([300, 900]);
  });
  it("상위그룹 축이 설계서대로 묶인다", () => {
    const timeline = buildAssetTimeline(
      [
        line("2026-01-31", "a", "kr_stock", 100),
        line("2026-01-31", "a", "foreign_equity", 200),
        line("2026-01-31", "a", "kr_listed_foreign_equity", 300),
        line("2026-01-31", "a", "deposit", 400),
        line("2026-01-31", "a", "gold", 50),
      ],
      ["a"],
      "parent",
      "month",
    );
    expect(timeline[0].buckets).toEqual([
      { key: "주식(원화)", name: "주식(원화)", amount: 100 },
      { key: "주식(달러)", name: "주식(달러)", amount: 500 },
      { key: "상품(원화)", name: "상품(원화)", amount: 400 },
      { key: "금", name: "금", amount: 50 },
    ]);
  });
  it("통화·위험 축의 합계가 그룹 축 합계와 같다", () => {
    for (const axis of ["group", "parent", "currency", "risk"] as const)
      expect(
        buildAssetTimeline(points, ["a", "b"], axis, "month").at(-1)!.total,
      ).toBe(8000);
  });
  it("카탈로그에 없는 옛 그룹도 합계에서 빠뜨리지 않는다", () => {
    const retired = buildAssetTimeline(
      [line("2026-01-31", "a", "retired_group", 500)],
      ["a"],
      "risk",
      "month",
    );
    expect(retired[0].total).toBe(500);
    expect(retired[0].buckets[0].key).toBe("UNKNOWN");
    expect(axisBucketOf("retired_group", "parent").key).toBe("미분류");
  });
  it("비중과 증감을 직전 기간 기준으로 계산한다", () => {
    const summary = buildAssetSummary(
      buildAssetTimeline(points, ["a"], "group", "month"),
    )!;
    expect(summary.period).toBe("2026-03");
    expect(summary.total).toBe(4000);
    expect(summary.previous_total).toBe(2000);
    expect(summary.change_rate).toBe(1);
    expect(summary.rows.find((r) => r.key === "kr_stock")!.share).toBe(0.75);
  });
  it("연평균 증가율을 실제 경과 개월로 계산한다", () => {
    const timeline = buildAssetTimeline(
      [
        line("2024-09-30", "a", "cash", 100000000),
        line("2026-09-30", "a", "cash", 121000000),
      ],
      ["a"],
      "group",
      "month",
    );
    expect(assetCagr(timeline)).toBeCloseTo(0.1, 6);
    expect(assetCagr([])).toBeNull();
  });
  it("사라진 그룹도 0원으로 한 줄 남겨 감소를 보여준다", () => {
    const summary = buildAssetSummary(
      buildAssetTimeline(
        [
          line("2026-01-31", "a", "gold", 1000),
          line("2026-02-28", "a", "cash", 1000),
        ],
        ["a"],
        "group",
        "month",
      ),
    )!;
    const gold = summary.rows.find((r) => r.key === "gold")!;
    expect(gold.amount).toBe(0);
    expect(gold.change).toBe(-1000);
  });
  it("분기에 한 번 기록하는 구성원의 값을 다음 달로 이월한다", () => {
    const timeline = buildAssetTimeline(
      [
        line("2026-01-31", "a", "cash", 100),
        line("2026-02-28", "a", "cash", 110),
        line("2026-03-31", "a", "cash", 120),
        line("2026-01-31", "b", "cash", 900),
        line("2026-04-30", "b", "cash", 950),
      ],
      ["a", "b"],
      "group",
      "month",
    );
    expect(timeline.map((p) => p.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
    // b는 2·3월에 기록이 없지만 1월 값이 이어진다.
    expect(timeline.map((p) => p.total)).toEqual([1000, 1010, 1020, 1070]);
    expect(timeline[1].carried).toEqual(["b"]);
    expect(timeline[2].carried).toEqual(["b"]);
    expect(timeline[3].carried).toEqual(["a"]);
  });
  it("기간 필터는 이월을 계산한 뒤 표시 범위만 자른다", () => {
    const points = Array.from({ length: 18 }, (_, i) =>
      line(
        `2025-${String((i % 12) + 1).padStart(2, "0")}-28`.replace(
          "2025",
          i < 12 ? "2025" : "2026",
        ),
        "a",
        "cash",
        100 + i,
      ),
    );
    const full = buildAssetTimeline(points, ["a"], "group", "month");
    expect(sliceTimeline(full, "month", "all")).toHaveLength(full.length);
    expect(sliceTimeline(full, "month", "1y")).toHaveLength(12);
    expect(sliceTimeline(full, "month", "1y").at(-1)).toEqual(full.at(-1));
  });
  it("스냅샷이 없으면 요약도 없다", () => {
    expect(buildAssetSummary([])).toBeNull();
    expect(buildAssetTimeline([], ["a"], "group", "month")).toEqual([]);
  });
});

describe("CSV 내보내기", () => {
  const row = {
    as_of: "2026-09-30",
    owner_name: "민섭",
    name: "삼성전자",
    broker: "",
    group_key: "kr_stock",
    amount: 47320000,
    quantity: 182,
    profit: 35479378,
    profit_rate: 2.9964,
  };
  it("설계서의 분류 항목을 모두 열로 낸다", () => {
    const csv = assetItemsCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const [header, first] = csv.trim().split("\n");
    expect(header).toContain("상위그룹");
    expect(header).toContain("수익률");
    expect(first).toBe(
      "2026-09-30,민섭,삼성전자,,주식,주식(원화),원화,위험,47320000,182,35479378,299.64%",
    );
  });
  it("쉼표와 따옴표가 든 이름을 깨뜨리지 않는다", () => {
    const csv = assetItemsCsv([
      { ...row, name: 'KODEX 27-12 회사채(AA-이상),"액티브"' },
    ]);
    expect(csv).toContain('"KODEX 27-12 회사채(AA-이상),""액티브"""');
  });
  it("없는 값은 빈 칸으로 둔다", () => {
    const csv = assetItemsCsv([
      { ...row, quantity: null, profit: null, profit_rate: null },
    ]);
    expect(csv.trim().split("\n")[1].endsWith(",47320000,,,")).toBe(true);
  });
});

describe("가상 데이터", () => {
  it("기록 주기가 다른 두 사람의 24개월치를 만든다", () => {
    const plan = demoAssetPlan();
    const monthly = plan.filter((s) => s.owner === "민섭");
    const quarterly = plan.filter((s) => s.owner === "장미");
    expect(monthly).toHaveLength(24);
    expect(quarterly).toHaveLength(8);
    // 두 사람의 마지막 기록은 같은 달이어야 최신 현황이 비지 않는다.
    expect(monthly.at(-1)!.as_of).toBe(quarterly.at(-1)!.as_of);
    expect(new Set(plan.map((s) => s.as_of.slice(0, 7))).size).toBe(24);
    for (const snapshot of plan) {
      expect(snapshot.items.length).toBeGreaterThan(0);
      for (const item of snapshot.items) {
        expect(item.amount).toBeGreaterThan(0);
        expect(findAssetGroup(item.group_key), item.group_key).toBeTruthy();
      }
    }
  });
  it("같은 값이 다시 나온다", () => {
    expect(demoAssetPlan()[0].items[0].amount).toBe(
      demoAssetPlan()[0].items[0].amount,
    );
  });
});
