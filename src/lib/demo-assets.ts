// 자산현황 화면을 확인하기 위한 가상 데이터. 시드가 고정이라 매번 같은 값이 나온다.
// /demo 화면과 로컬 DB 적재 스크립트가 같은 생성기를 쓴다.
import {
  assetCagr,
  assetGroupName,
  axisBucketOf,
  buildAssetSummary,
  buildAssetTimeline,
  periodOf,
  sliceTimeline,
  type AssetAxis,
  type AssetRange,
  type AssetLinePoint,
  type AssetPeriod,
  type AssetSummary,
  type AssetTimelinePoint,
} from "./assets";
export type DemoItem = {
  group_key: string;
  name: string;
  broker: string;
  amount: number;
  quantity: number | null;
  profit: number | null;
  profit_rate: number | null;
};
export type DemoSnapshot = {
  owner: string;
  as_of: string;
  items: DemoItem[];
};
type Seed = {
  group_key: string;
  name: string;
  broker: string;
  base: number;
  drift: number;
  swing: number;
  unitPrice?: number;
};
const MONTHS = 24;
// 실제 사용에서는 사람마다 기록 주기가 다르다. 민섭은 매달, 장미는 분기에 한 번 기록한다고 본다.
// 기록이 없는 달은 화면에서 직전 기록을 이월해 보여준다.
const cadence: Record<string, number> = { 민섭: 1, 장미: 3 };
const END = { year: 2026, month: 9 };
const owners = ["민섭", "장미"] as const;
const plans: Record<string, Seed[]> = {
  민섭: [
    {
      group_key: "kr_stock",
      name: "삼성전자",
      broker: "",
      base: 42000000,
      drift: 0.009,
      swing: 0.055,
      unitPrice: 260000,
    },
    {
      group_key: "kr_stock",
      name: "KODEX 200",
      broker: "",
      base: 9800000,
      drift: 0.006,
      swing: 0.042,
      unitPrice: 42000,
    },
    {
      group_key: "foreign_equity",
      name: "코카콜라",
      broker: "",
      base: 28000000,
      drift: 0.011,
      swing: 0.048,
      unitPrice: 95000,
    },
    {
      group_key: "foreign_equity",
      name: "VANGUARD S&P 500",
      broker: "",
      base: 21000000,
      drift: 0.013,
      swing: 0.05,
      unitPrice: 720000,
    },
    {
      group_key: "kr_listed_foreign_equity",
      name: "TIGER 미국S&P500",
      broker: "",
      base: 24000000,
      drift: 0.012,
      swing: 0.046,
      unitPrice: 21000,
    },
    {
      group_key: "kr_bond",
      name: "한국투자캐피탈131-2",
      broker: "삼성증권",
      base: 9600000,
      drift: 0.003,
      swing: 0.006,
    },
    {
      group_key: "foreign_bond",
      name: "T 0.5 08/31/27",
      broker: "한국투자증권",
      base: 14500000,
      drift: 0.004,
      swing: 0.012,
    },
    {
      group_key: "usd_note_rp",
      name: "퍼스트 외화 발행어음 약정(USD)",
      broker: "한국투자증권",
      base: 17500000,
      drift: 0.003,
      swing: 0.01,
    },
    {
      group_key: "krw_note_rp",
      name: "퍼스트 발행어음 특판(e)",
      broker: "한국투자증권",
      base: 11000000,
      drift: 0.003,
      swing: 0.004,
    },
    {
      group_key: "deposit",
      name: "예적금",
      broker: "",
      base: 38000000,
      drift: 0.007,
      swing: 0.002,
    },
    {
      group_key: "cash",
      name: "CMA RP",
      broker: "미래에셋증권",
      base: 8200000,
      drift: 0.002,
      swing: 0.09,
    },
    {
      group_key: "gold",
      name: "금 99.99_1kg",
      broker: "한국투자증권",
      base: 9500000,
      drift: 0.012,
      swing: 0.035,
      unitPrice: 128000,
    },
  ],
  장미: [
    {
      group_key: "kr_stock",
      name: "신한지주",
      broker: "",
      base: 13500000,
      drift: 0.007,
      swing: 0.05,
      unitPrice: 58000,
    },
    {
      group_key: "foreign_equity",
      name: "알파벳 A",
      broker: "",
      base: 16000000,
      drift: 0.014,
      swing: 0.06,
      unitPrice: 240000,
    },
    {
      group_key: "kr_listed_foreign_equity",
      name: "ACE 미국배당다우존스",
      broker: "",
      base: 12500000,
      drift: 0.011,
      swing: 0.04,
      unitPrice: 11500,
    },
    {
      group_key: "kr_bond",
      name: "한국캐피탈550-2",
      broker: "삼성증권",
      base: 5200000,
      drift: 0.003,
      swing: 0.005,
    },
    {
      group_key: "krw_note_rp",
      name: "ISA특판RP(e)-24시간",
      broker: "한국투자증권",
      base: 7400000,
      drift: 0.003,
      swing: 0.004,
    },
    {
      group_key: "deposit",
      name: "예적금",
      broker: "",
      base: 31000000,
      drift: 0.008,
      swing: 0.002,
    },
    {
      group_key: "cash",
      name: "현금",
      broker: "",
      base: 5600000,
      drift: 0.002,
      swing: 0.08,
    },
    {
      group_key: "gold",
      name: "금 99.99_1kg",
      broker: "한국투자증권",
      base: 4200000,
      drift: 0.012,
      swing: 0.035,
      unitPrice: 128000,
    },
  ],
};
function random(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lastDay = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
export function demoAssetPlan(): DemoSnapshot[] {
  const months: { year: number; month: number }[] = [];
  let { year, month } = END;
  for (let i = 0; i < MONTHS; i++) {
    months.unshift({ year, month });
    if (--month < 1) [year, month] = [year - 1, 12];
  }
  const out: DemoSnapshot[] = [];
  for (const [ownerIndex, owner] of owners.entries())
    for (const [step, m] of months.entries()) {
      // 마지막 달은 항상 남겨 최신 기록이 비지 않게 한다.
      const every = cadence[owner] ?? 1;
      if ((months.length - 1 - step) % every !== 0) continue;
      const items = plans[owner].map((seed, i) => {
        const rnd = random(ownerIndex * 1000 + i * 37 + step * 7);
        const growth = (1 + seed.drift) ** step;
        const noise = 1 + (rnd() - 0.5) * seed.swing * 2;
        const amount = Math.round((seed.base * growth * noise) / 1000) * 1000;
        const cost = Math.round(seed.base * (1 + seed.drift * step * 0.35));
        const profit = amount - cost;
        return {
          group_key: seed.group_key,
          name: seed.name,
          broker: seed.broker,
          amount,
          quantity: seed.unitPrice
            ? Math.max(1, Math.round(amount / seed.unitPrice))
            : null,
          profit,
          profit_rate: cost > 0 ? Number((profit / cost).toFixed(6)) : null,
        };
      });
      out.push({ owner, as_of: lastDay(m.year, m.month), items });
    }
  return out;
}
const plan = demoAssetPlan();
const ownerId = (name: string) =>
  `demo-owner-${owners.indexOf(name as "민섭")}`;
const points: AssetLinePoint[] = plan.flatMap((s) =>
  s.items.map((i) => ({
    as_of: s.as_of,
    owner_id: ownerId(s.owner),
    group_key: i.group_key,
    amount: i.amount,
  })),
);
const AXES: AssetAxis[] = ["group", "parent", "currency", "risk"];
export function demoAssetOverview(params: URLSearchParams) {
  const owner = params.get("owner") || "all";
  const period: AssetPeriod =
    params.get("period") === "year" ? "year" : "month";
  const range = (
    ["1y", "2y", "5y", "all"].includes(params.get("range") ?? "")
      ? params.get("range")
      : "all"
  ) as AssetRange;
  const list = owners.map((name) => ({
    id: ownerId(name),
    name,
    user_id: null,
    sort_order: owners.indexOf(name),
    active: true,
    version: 1,
    linked: false,
  }));
  const ids = owner === "all" ? list.map((o) => o.id) : [owner];
  const timelines = Object.fromEntries(
    AXES.map((axis) => [
      axis,
      sliceTimeline(
        buildAssetTimeline(points, ids, axis, period),
        period,
        range,
      ),
    ]),
  ) as Record<AssetAxis, AssetTimelinePoint[]>;
  const summaries = Object.fromEntries(
    AXES.map((axis) => [axis, buildAssetSummary(timelines[axis])]),
  ) as Record<AssetAxis, AssetSummary | null>;
  const currency = timelines.currency.filter((p) => p.total > 0).at(-1);
  const mix = (key: string) =>
    currency?.buckets.find((b) => b.key === key)?.amount ?? 0;
  const withData = timelines.group.filter((p) => p.total > 0);
  return {
    owners: list,
    owner,
    period,
    range,
    rules_version: "demo",
    timelines,
    summaries,
    cagr: assetCagr(timelines.group),
    currencyMix: { KRW: mix("KRW"), USD: mix("USD"), NONE: mix("NONE") },
    ownerTotals: ids.map((id) => {
      const now = withData.at(-1)?.owners.find((x) => x.owner_id === id);
      const then = withData.at(-2)?.owners.find((x) => x.owner_id === id);
      return {
        owner_id: id,
        name: list.find((o) => o.id === id)?.name ?? id,
        as_of: now?.as_of ?? null,
        total: now?.amount ?? 0,
        change: now && then ? now.amount - then.amount : null,
      };
    }),
    unclassified: 0,
  };
}
function itemRows(snapshot: DemoSnapshot) {
  return snapshot.items.map((item, i) => ({
    id: `${snapshot.owner}-${snapshot.as_of}-${i}`,
    position: i,
    group_key: item.group_key,
    group_name: assetGroupName(item.group_key),
    name: item.name,
    broker: item.broker,
    amount: item.amount,
    quantity: item.quantity,
    profit: item.profit,
    profit_rate: item.profit_rate,
    owner_id: ownerId(snapshot.owner),
    owner_name: snapshot.owner,
    as_of: snapshot.as_of,
  }));
}
export function demoAssetItems(target: {
  at: string;
  axis: AssetAxis;
  bucket: string;
}) {
  const period: AssetPeriod = target.at.length === 4 ? "year" : "month";
  const chosen = owners
    .map((owner) =>
      plan
        .filter(
          (s) => s.owner === owner && periodOf(s.as_of, period) <= target.at,
        )
        .at(-1),
    )
    .filter((s): s is DemoSnapshot => Boolean(s));
  return chosen
    .flatMap(itemRows)
    .filter((i) => axisBucketOf(i.group_key, target.axis).key === target.bucket)
    .sort((a, b) => b.amount - a.amount);
}
export function demoAssetHistory(selected: string) {
  const snapshots = [...plan]
    .reverse()
    .map((s, i) => ({
      id: `${s.owner}-${s.as_of}`,
      owner_id: ownerId(s.owner),
      owner_name: s.owner,
      as_of: s.as_of,
      source: i % 3 === 0 ? "mcp" : "web",
      note: "",
      version: 1,
      rules_version: "demo",
      total: s.items.reduce((n, x) => n + x.amount, 0),
      item_count: s.items.length,
      updated_at: `${s.as_of}T00:00:00Z`,
      canEdit: false,
    }))
    .sort((a, b) => (a.as_of < b.as_of ? 1 : -1));
  const target =
    snapshots.find((s) => s.id === selected) ?? snapshots[0] ?? null;
  const source = target
    ? plan.find((s) => `${s.owner}-${s.as_of}` === target.id)
    : undefined;
  return {
    owners: [],
    snapshots,
    selected:
      target && source ? { snapshot: target, items: itemRows(source) } : null,
  };
}
