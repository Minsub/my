// 자산 그룹 카탈로그와 분류 룰의 단일 기준. 웹 화면·서버 집계·MCP 룰 조회가 모두 이 파일을 읽는다.
// DB에 두지 않는 이유: 룰의 우선순위 한 줄이 분류 결과 전체를 좌우하므로 코드 리뷰와 회귀 테스트 대상이어야 한다.
export type AssetCurrency = "KRW" | "USD" | "NONE";
export type AssetRisk = "RISKY" | "SAFE";
export type AssetGroup = {
  key: string;
  name: string;
  currency: AssetCurrency;
  risk: AssetRisk | null;
  parent: string;
  definition: string;
  examples: string[];
  not?: string[];
};
// 룰을 고치면 이 값을 올린다. 스냅샷에 함께 저장해 "어떤 기준으로 만든 숫자인가"를 추적한다.
export const assetRulesVersion = "2026-09-19";
export const assetGroups: readonly AssetGroup[] = [
  {
    key: "kr_stock",
    name: "주식",
    currency: "KRW",
    risk: "RISKY",
    parent: "주식(원화)",
    definition:
      "국내 거래소에 상장한 개별주·우선주와 국내 지수·업종을 따르는 ETF, TDF.",
    examples: [
      "삼성전자",
      "현대차2우B",
      "NAVER",
      "KODEX 200",
      "TIGER 반도체",
      "RISE TDF2050액티브 적격",
    ],
    not: [
      "미국·나스닥 등 해외 지수를 따르는 국내 상장 ETF는 kr_listed_foreign_equity",
      "해외 거래소에서 직접 보유한 종목은 foreign_equity",
    ],
  },
  {
    key: "foreign_equity",
    name: "해외 주식",
    currency: "USD",
    risk: "RISKY",
    parent: "주식(달러)",
    definition:
      "해외 거래소에서 직접 보유한 개별주와 해외 상장 ETF. 한글 음차 표기도 포함한다.",
    examples: [
      "코카콜라",
      "알파벳 A",
      "월트 디즈니",
      "VANGUARD S&P 500",
      "iShares Global Clean Energy ETF",
    ],
    not: ["국내 거래소에 상장한 해외 지수 ETF는 kr_listed_foreign_equity"],
  },
  {
    key: "kr_listed_foreign_equity",
    name: "국내상장 해외주식",
    currency: "USD",
    risk: "RISKY",
    parent: "주식(달러)",
    definition:
      "국내 운용사가 국내 거래소에 상장했고 해외 지수·해외 주식을 따르는 ETF. 원화로 사지만 환노출은 외화다.",
    examples: [
      "ACE 미국배당다우존스",
      "RISE 미국나스닥100",
      "TIGER 미국S&P500",
    ],
    not: ["해외 거래소에서 직접 보유한 종목은 foreign_equity"],
  },
  {
    key: "kr_bond",
    name: "국내 채권",
    currency: "KRW",
    risk: "SAFE",
    parent: "상품(원화)",
    definition:
      "원화 표시 개별 채권(회사채·캐피탈채·카드채·MBS·국고채)과 국내 채권형 ETF.",
    examples: [
      "한국투자캐피탈131-2",
      "주택금융공사MBS2019-18(1-5)(사)",
      "KODEX 27-12 회사채(AA-이상)액티브",
    ],
  },
  {
    key: "foreign_bond",
    name: "해외 채권",
    currency: "USD",
    risk: "SAFE",
    parent: "상품(달러)",
    definition: "미국 국채 등 외화 표시 채권.",
    examples: ["T 0.5 08/31/27", "미국 국채"],
    not: ["이름에 미국이 들어가도 채권이면 주식 그룹으로 보내지 않는다"],
  },
  {
    key: "usd_note_rp",
    name: "달러 발행어음/RP",
    currency: "USD",
    risk: "SAFE",
    parent: "상품(달러)",
    definition: "외화(USD) 표시 발행어음과 RP.",
    examples: [
      "퍼스트 외화 발행어음 약정(USD)",
      "외화RP(USD)(개인 기간형)",
      "외화RP(USD)자동매매(개인)",
    ],
  },
  {
    key: "krw_note_rp",
    name: "원화 발행어음/RP",
    currency: "KRW",
    risk: "SAFE",
    parent: "상품(원화)",
    definition: "원화 표시 발행어음과 RP.",
    examples: ["퍼스트 발행어음 특판(e)", "ISA특판RP(e)-24시간"],
    not: ["적립식 발행어음은 deposit", "CMA RP는 cash"],
  },
  {
    key: "deposit",
    name: "예적금",
    currency: "KRW",
    risk: "SAFE",
    parent: "상품(원화)",
    definition:
      "예금·적금과 적립식 발행어음, IMA처럼 만기까지 묶어두는 적립성 상품.",
    examples: ["퍼스트 발행어음 적립(정액)", "한국투자 IMA S1"],
  },
  {
    key: "cash",
    name: "현금",
    currency: "KRW",
    risk: "SAFE",
    parent: "상품(원화)",
    definition: "즉시 쓸 수 있는 현금성 잔고. CMA와 예수금.",
    examples: ["CMA RP", "예수금"],
  },
  {
    key: "gold",
    name: "금",
    currency: "NONE",
    risk: "SAFE",
    parent: "금",
    definition: "금 현물.",
    examples: ["금 99.99_1kg"],
  },
  {
    key: "unclassified",
    name: "미분류",
    currency: "NONE",
    risk: null,
    parent: "미분류",
    definition:
      "어느 그룹인지 판단이 서지 않는 자산. 추측으로 다른 그룹에 넣지 말고 여기에 담아 사용자에게 확인을 요청한다.",
    examples: [],
  },
];
export const assetGroupKeys = assetGroups.map((g) => g.key) as [
  string,
  ...string[],
];
const groupIndex = new Map(assetGroups.map((g) => [g.key, g]));
export const findAssetGroup = (key: string) => groupIndex.get(key);
export const assetGroupName = (key: string) => groupIndex.get(key)?.name ?? key;

// 여러 규칙이 동시에 맞는 값이 실제 데이터에 흔하다(발행어음 적립, 외화 발행어음, CMA RP, 미국 국채).
// priority 오름차순으로 평가하고 처음 맞은 규칙 하나만 적용한다.
export type AssetRule = {
  priority: number;
  group: string;
  any_of: string[];
  all_of?: string[];
  why?: string;
};
const ETF_BRAND =
  "^(KODEX|TIGER|ACE|RISE|SOL|PLUS|HANARO|KOSEF|ARIRANG|TIMEFOLIO|KIWOOM|히어로즈)[\\s0-9]";
const OVERSEAS_INDEX =
  "미국|나스닥|NASDAQ|S&P|다우존스|글로벌|선진국|차이나|중국|인도|일본|유로|베트남|신흥국|아시아|필라델피아";
export const assetRules: readonly AssetRule[] = [
  {
    priority: 10,
    group: "gold",
    any_of: ["^금[\\s0-9]", "금현물", "KRX\\s*금"],
    why: "금 뒤에 공백이나 숫자를 요구해 금융지주 같은 이름이 걸리지 않게 한다.",
  },
  {
    priority: 20,
    group: "cash",
    any_of: [
      "\\bCMA\\b",
      "^예수금",
      "예수금$",
      "^현금$",
      "현금성\\s*자산",
      "\\bMMF\\b",
      "신종\\s*종류형",
    ],
    why: "CMA RP는 RP를 포함하지만 현금성이므로 발행어음/RP보다 먼저 판정한다. MMF·현금성자산도 같은 이유로 여기서 먼저 걷어낸다. 증권사가 회차를 붙인 MMF(삼성신종종류형MMF제4호-CP)가 개별 채권 패턴에 걸리면 안전자산 구성이 뒤집힌다.",
  },
  {
    priority: 30,
    group: "deposit",
    any_of: [
      "\\bIMA\\b",
      "발행어음\\s*적립",
      "적금",
      "정기예금",
      "파킹",
      "^예금$",
      "예적금",
    ],
    why: "적립식 발행어음은 발행어음/RP가 아니라 적립성 상품이므로 먼저 판정한다. 계좌 밖 자산은 이름이 `예금` 한 단어로 들어오므로 앵커를 걸어 `정기예금`과 따로 받는다.",
  },
  {
    priority: 40,
    group: "usd_note_rp",
    any_of: ["발행어음", "\\bRP\\b", "환매조건부"],
    all_of: ["USD|외화|달러"],
    why: "같은 발행어음·RP라도 외화 표시면 원화 그룹보다 먼저 가른다.",
  },
  {
    priority: 50,
    group: "foreign_bond",
    any_of: [
      "^T\\s+\\d+(\\.\\d+)?\\s+\\d{2}/\\d{2}/\\d{2}$",
      "미국\\s*국채",
      "미국채",
      "해외\\s*국채",
      "US\\s*TREASURY",
      "T-?(BILL|NOTE|BOND)",
    ],
    why: "미국 국채가 뒤쪽 미국 ETF 규칙에 걸리면 안전자산이 위험자산으로 뒤집힌다. 원문의 T * DD/MM/YY는 실제로는 MM/DD/YY다.",
  },
  {
    priority: 60,
    group: "krw_note_rp",
    any_of: ["발행어음", "\\bRP\\b", "환매조건부"],
  },
  {
    priority: 70,
    group: "kr_bond",
    any_of: [
      "회사채",
      "국고채",
      "은행채",
      "산금채",
      "공사채",
      "카드채",
      "여전채",
      "특수채",
      "캐피탈",
      "MBS",
      "크레딧",
    ],
    why: "채권형 ETF도 자산 성격을 기준으로 채권에 넣는다. 위험·안전 축을 쓰는 화면에서 채권 ETF를 위험으로 두면 축이 무의미해진다.",
  },
  {
    priority: 80,
    group: "kr_bond",
    any_of: ["^[가-힣A-Za-z()·\\s]+\\d+-\\d+"],
    why: "{발행사}{회차}-{세부} 형태의 개별 채권.",
  },
  {
    priority: 90,
    group: "kr_listed_foreign_equity",
    any_of: [ETF_BRAND],
    all_of: [OVERSEAS_INDEX],
    why: "이름에 ETF라는 글자가 없으므로 국내 운용사 브랜드 접두사로 ETF를 판별한다.",
  },
  {
    priority: 100,
    group: "kr_stock",
    any_of: [ETF_BRAND, "TDF"],
  },
  {
    priority: 110,
    group: "foreign_equity",
    any_of: ["^[A-Za-z][A-Za-z0-9.&'\\-]*(\\s+[A-Za-z0-9.&'\\-]+)+$"],
    why: "영문 두 단어 이상인 종목명은 해외 직접보유로 본다. NAVER처럼 한 단어인 국내 종목을 잘못 가져가지 않도록 두 단어 이상을 요구한다.",
  },
];
const compiled = assetRules.map((rule) => ({
  rule,
  any: rule.any_of.map((p) => new RegExp(p, "i")),
  all: (rule.all_of ?? []).map((p) => new RegExp(p, "i")),
}));
export type AssetClassification = {
  group_key: string;
  priority: number | null;
  needs_review: boolean;
};
// 규칙으로 확정되는 것만 확정한다. 개별 종목명은 상장 거래소를 알아야 판별되므로 규칙이 답하지 않는다.
export function classifyAsset(name: string): AssetClassification {
  const value = name.trim();
  for (const { rule, any, all } of compiled)
    if (any.some((r) => r.test(value)) && all.every((r) => r.test(value)))
      return {
        group_key: rule.group,
        priority: rule.priority,
        needs_review: false,
      };
  return { group_key: "unclassified", priority: null, needs_review: true };
}
// MCP 룰 조회 도구가 그대로 내보내는 응답.
export function assetClassificationRules() {
  return {
    rules_version: assetRulesVersion,
    amount_unit: "KRW",
    amount_note:
      "모든 금액은 원화로 환산된 정수다. 외화 자산도 증권사 화면에 표시된 원화 평가금액을 그대로 쓴다. 환율을 직접 계산하지 않는다.",
    axes: {
      currency: "그룹이 들고 있는 환노출 통화다. 거래 통화가 아니다.",
      risk: "위험(RISKY)·안전(SAFE) 자산 구분이다.",
    },
    groups: assetGroups,
    rules: assetRules,
    fallback: { group: "unclassified" },
    instructions: [
      "rules를 priority 오름차순으로 평가하고, 처음 맞은 규칙 하나만 적용한 뒤 멈춘다. 정규식은 대소문자를 구분하지 않는다.",
      "any_of는 하나라도 맞으면 되고, all_of는 모두 맞아야 한다.",
      "rules는 금융상품(발행어음·RP·채권·예적금·금·현금·국내 ETF)만 확정한다. 개별 종목명은 규칙으로 판별되지 않는다.",
      "개별 종목은 상장 거래소를 기준으로 직접 판단한다. 국내 거래소면 kr_stock, 해외 거래소 직접보유면 foreign_equity다. 한글 음차 표기(코카콜라, 월트 디즈니)도 해외 거래소 종목이면 foreign_equity다.",
      "확실하지 않으면 unclassified에 담고 사용자에게 확인을 요청한다. 추측으로 다른 그룹에 넣지 않는다.",
      "분류가 끝나면 그 결과를 원본 행과 다시 합친다. 원본 한 행이 items 한 개다. 같은 group_key끼리 금액을 합산하지 않는다.",
      "items의 name은 원본에 적힌 종목명을 그대로 쓴다(삼성전자). 그룹 이름(주식)을 name에 넣으면 그룹을 눌러도 무엇이 들어 있는지 볼 수 없다.",
      "원본에 있는 증권사·수량·수익금·수익률은 broker·quantity·profit·profit_rate로 함께 보내고, 없는 값은 null로 둔다. 수익률은 비율이다. 1.94%는 0.0194다.",
      "rules_version을 그대로 함께 보낸다.",
    ],
    write_contract: {
      tool: "asset_record_snapshot",
      unit: "원본 종목 한 줄 = items 한 개",
      items: "{group_key, name, broker, amount, quantity, profit, profit_rate}",
      note: "그룹 합계는 서버가 items에서 계산하므로 보내지 않는다. 같은 owner_id와 as_of로 저장하면 그 날짜의 기존 값을 전부 교체한다. 일부만 보내면 나머지는 사라지므로 항상 그 사람의 자산 전체를 한 번에 보낸다.",
    },
  };
}

export const assetSubMenus = [
  {
    key: "status",
    path: "/assets/status",
    title: "자산현황",
    description: "구성원별 자산을 그룹으로 나눠 시계열로 증감과 종합을 봅니다.",
  },
  {
    key: "cash",
    path: "/cash",
    title: "가계부",
    description: "엑셀로 모은 수입과 지출을 연·월별로 분석합니다.",
  },
  {
    key: "cash-old",
    path: "/cash/old",
    title: "가계부 (old)",
    description: "기존 단일 HTML 분석 화면을 그대로 사용합니다.",
  },
] as const;

// ---- 집계 ----
// 화면은 날짜가 아니라 기간(월·연) 단위로 본다. 한 기간에 기록이 여러 건이면 그 기간의 가장 최신 기록을 쓴다.
// 소유자마다 기록한 달이 다를 수 있으므로 각 기간마다 소유자별로 그 기간 이하 최신 기록을 이어 쓴다.
export type AssetAxis = "group" | "parent" | "currency" | "risk";
export type AssetPeriod = "month" | "year";
export type AssetLinePoint = {
  as_of: string;
  owner_id: string;
  group_key: string;
  amount: number;
};
export type AssetOwner = {
  id: string;
  name: string;
  user_id: string | null;
  sort_order: number;
  active: boolean;
  version: number;
};
export type AssetBucket = { key: string; name: string; amount: number };
export type AssetTimelinePoint = {
  period: string;
  as_of: string;
  total: number;
  buckets: AssetBucket[];
  owners: { owner_id: string; as_of: string; amount: number }[];
  carried: string[];
};
const currencyNames: Record<string, string> = {
  KRW: "원화",
  USD: "달러",
  NONE: "기타",
};
const riskNames: Record<string, string> = {
  RISKY: "위험",
  SAFE: "안전",
  UNKNOWN: "미분류",
};
export const parentOrder = [
  "주식(원화)",
  "주식(달러)",
  "상품(원화)",
  "상품(달러)",
  "금",
  "미분류",
];
export type AssetRange = "all" | "1y" | "2y" | "5y";
export const assetRanges: { key: AssetRange; label: string; years: number }[] =
  [
    { key: "1y", label: "최근 1년", years: 1 },
    { key: "2y", label: "최근 2년", years: 2 },
    { key: "5y", label: "최근 5년", years: 5 },
    { key: "all", label: "전체", years: 0 },
  ];
// 기간 필터는 조회 범위가 아니라 표시 범위다. 이월을 계산한 뒤 잘라야
// 분기에 한 번 기록하는 구성원의 값이 창 시작에서 사라지지 않는다.
// 기록이 없는 기간을 축에서 지우므로 개수로 자르면 "최근 1년"이 1년을 넘어간다.
// 마지막 기간에서 range만큼 거슬러 올라간 라벨을 구해 그 이후만 남긴다.
export function sliceTimeline<T extends { period: string }>(
  timeline: T[],
  period: AssetPeriod,
  range: AssetRange,
): T[] {
  const years = assetRanges.find((r) => r.key === range)?.years ?? 0;
  const last = timeline.at(-1)?.period;
  if (!years || !last) return timeline;
  if (period === "year")
    return timeline.filter((p) => Number(p.period) > Number(last) - years);
  const [y, m] = [Number(last.slice(0, 4)), Number(last.slice(5, 7))];
  const cutoff = `${y - years}-${String(m).padStart(2, "0")}`;
  return timeline.filter((p) => p.period > cutoff);
}
export const assetAxes: { key: AssetAxis; label: string }[] = [
  { key: "group", label: "자산 그룹" },
  { key: "parent", label: "상위 그룹" },
  { key: "currency", label: "통화" },
  { key: "risk", label: "위험" },
];
export function axisBucketOf(groupKey: string, axis: AssetAxis) {
  const group = groupIndex.get(groupKey);
  if (axis === "group") return { key: groupKey, name: group?.name ?? groupKey };
  if (axis === "parent") {
    const key = group?.parent ?? "미분류";
    return { key, name: key };
  }
  if (axis === "currency") {
    const key = group?.currency ?? "NONE";
    return { key, name: currencyNames[key] };
  }
  const key = group?.risk ?? "UNKNOWN";
  return { key, name: riskNames[key] };
}
export function axisOrder(axis: AssetAxis): string[] {
  if (axis === "group") return assetGroups.map((g) => g.key);
  if (axis === "parent") return parentOrder;
  if (axis === "currency") return ["KRW", "USD", "NONE"];
  return ["RISKY", "SAFE", "UNKNOWN"];
}
export const periodOf = (date: string, period: AssetPeriod) =>
  period === "year" ? date.slice(0, 4) : date.slice(0, 7);
export const periodLabel = (value: string) =>
  value.length === 4
    ? `${value}년`
    : `${value.slice(0, 4)}/${value.slice(5, 7)}`;
// 첫 기록부터 마지막 기록까지 모든 기간을 만든다. 이월을 계산해야 하므로 여기서는 빈 기간도 낸다.
// 아무도 기록하지 않은 기간을 버리는 것은 buildAssetTimeline의 마지막 filter다.
export function periodRange(
  first: string,
  last: string,
  period: AssetPeriod,
): string[] {
  const out: string[] = [];
  if (period === "year") {
    for (let y = Number(first); y <= Number(last); y++) out.push(String(y));
    return out;
  }
  let [y, m] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  const [ly, lm] = [Number(last.slice(0, 4)), Number(last.slice(5, 7))];
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}
export function buildAssetTimeline(
  points: AssetLinePoint[],
  ownerIds: string[],
  axis: AssetAxis,
  period: AssetPeriod = "month",
): AssetTimelinePoint[] {
  const selected = new Set(ownerIds);
  const byOwner = new Map<string, Map<string, Map<string, number>>>();
  const dates: string[] = [];
  for (const p of points) {
    if (!selected.has(p.owner_id)) continue;
    dates.push(p.as_of);
    const byDate = byOwner.get(p.owner_id) ?? new Map();
    byOwner.set(p.owner_id, byDate);
    const byGroup = byDate.get(p.as_of) ?? new Map();
    byDate.set(p.as_of, byGroup);
    byGroup.set(p.group_key, (byGroup.get(p.group_key) ?? 0) + p.amount);
  }
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const order = axisOrder(axis);
  const rank = new Map(order.map((k, i) => [k, i]));
  return (
    periodRange(
      periodOf(sorted[0], period),
      periodOf(sorted.at(-1)!, period),
      period,
    )
      .map((label) => {
        const sums = new Map<string, AssetBucket>();
        const owners: AssetTimelinePoint["owners"] = [];
        const carried: string[] = [];
        let latest = "";
        for (const ownerId of ownerIds) {
          const byDate = byOwner.get(ownerId);
          if (!byDate) continue;
          // 기간 안에 여러 건이면 가장 최신 기록, 없으면 그 이전의 마지막 기록을 이어 쓴다.
          const effective = [...byDate.keys()]
            .filter((d) => periodOf(d, period) <= label)
            .sort()
            .pop();
          if (!effective) continue;
          if (periodOf(effective, period) !== label) carried.push(ownerId);
          if (effective > latest) latest = effective;
          let ownerTotal = 0;
          for (const [groupKey, amount] of byDate.get(effective)!) {
            const bucket = axisBucketOf(groupKey, axis);
            const acc = sums.get(bucket.key) ?? { ...bucket, amount: 0 };
            acc.amount += amount;
            sums.set(bucket.key, acc);
            ownerTotal += amount;
          }
          owners.push({
            owner_id: ownerId,
            as_of: effective,
            amount: ownerTotal,
          });
        }
        const buckets = [...sums.values()].sort(
          (a, b) =>
            (rank.get(a.key) ?? order.length) -
            (rank.get(b.key) ?? order.length),
        );
        return {
          period: label,
          as_of: latest,
          total: buckets.reduce((n, b) => n + b.amount, 0),
          buckets,
          owners,
          carried,
        };
      })
      // 아무도 그 기간에 기록하지 않았으면 축에서 뺀다. 직전 값을 그대로 이어 그린 평평한 구간은
      // 실제로 변화가 없었다는 뜻이 아니라 기록이 없었다는 뜻이라 증감을 잘못 읽게 만든다.
      // 한 사람이라도 그 기간에 기록했으면 남기고, 기록이 없는 사람만 직전 값을 이어 쓴다.
      .filter((p) => p.owners.length > p.carried.length)
  );
}
export const assetChangeRate = (now: number, before: number) =>
  before > 0 ? (now - before) / before : null;
// 연평균 증가율. 첫 기록과 마지막 기록 사이 실제 경과 개월로 계산한다.
export function assetCagr(timeline: AssetTimelinePoint[]) {
  const withData = timeline.filter((p) => p.total > 0);
  const first = withData[0];
  const last = withData.at(-1);
  if (!first || !last || first === last || first.total <= 0) return null;
  const months = monthsBetween(first.period, last.period);
  if (months <= 0) return null;
  return (last.total / first.total) ** (12 / months) - 1;
}
function monthsBetween(a: string, b: string) {
  const parse = (v: string) =>
    v.length === 4
      ? [Number(v), 1]
      : [Number(v.slice(0, 4)), Number(v.slice(5, 7))];
  const [ay, am] = parse(a);
  const [by, bm] = parse(b);
  return (by - ay) * 12 + (bm - am);
}
export type AssetSummaryRow = {
  key: string;
  name: string;
  amount: number;
  share: number | null;
  change: number | null;
  change_rate: number | null;
};
export type AssetSummary = {
  period: string;
  as_of: string;
  total: number;
  previous_period: string | null;
  previous_total: number | null;
  change: number | null;
  change_rate: number | null;
  rows: AssetSummaryRow[];
  carried: string[];
};
export function buildAssetSummary(
  timeline: AssetTimelinePoint[],
): AssetSummary | null {
  const withData = timeline.filter((p) => p.total > 0);
  const latest = withData.at(-1);
  if (!latest) return null;
  const previous = withData.at(-2) ?? null;
  const before = new Map(previous?.buckets.map((b) => [b.key, b.amount]) ?? []);
  const now = new Map(latest.buckets.map((b) => [b.key, b]));
  const keys = [
    ...latest.buckets.map((b) => b.key),
    ...(previous?.buckets ?? [])
      .filter((b) => !now.has(b.key))
      .map((b) => b.key),
  ];
  return {
    period: latest.period,
    as_of: latest.as_of,
    total: latest.total,
    previous_period: previous?.period ?? null,
    previous_total: previous?.total ?? null,
    change: previous ? latest.total - previous.total : null,
    change_rate: previous
      ? assetChangeRate(latest.total, previous.total)
      : null,
    carried: latest.carried,
    rows: keys.map((key) => {
      const bucket = now.get(key);
      const amount = bucket?.amount ?? 0;
      const prior = before.get(key);
      return {
        key,
        name:
          bucket?.name ??
          previous?.buckets.find((b) => b.key === key)?.name ??
          key,
        amount,
        share: latest.total > 0 ? amount / latest.total : null,
        change: prior === undefined ? null : amount - prior,
        change_rate:
          prior === undefined ? null : assetChangeRate(amount, prior),
      };
    }),
  };
}
// 차트는 모든 기간에 같은 계열이 있어야 한다. 중간에 없는 그룹은 0으로 채운다.
export function assetTimelineSeries(timeline: AssetTimelinePoint[]) {
  const names = new Map<string, string>();
  for (const point of timeline)
    for (const bucket of point.buckets) names.set(bucket.key, bucket.name);
  return [...names].map(([key, name]) => ({
    key,
    name,
    values: timeline.map(
      (point) => point.buckets.find((b) => b.key === key)?.amount ?? 0,
    ),
  }));
}
export const assetMoney = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
export function assetCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 100000000)
    return `${(n / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억`;
  if (abs >= 10000)
    return `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`;
  return assetMoney(n);
}
export const assetPct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
export const assetSignedPct = (n: number | null) =>
  n === null ? "—" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
export const assetSignedMoney = (n: number | null) =>
  n === null ? "—" : `${n >= 0 ? "+" : "-"}${assetCompact(Math.abs(n))}`;

// 내보내기용 CSV. 엑셀이 UTF-8로 열도록 BOM을 붙이고 쉼표·따옴표를 escape한다.
export type AssetCsvRow = {
  as_of: string;
  owner_name: string;
  name: string;
  broker: string;
  group_key: string;
  amount: number;
  quantity: number | null;
  profit: number | null;
  profit_rate: number | null;
};
export function assetItemsCsv(rows: AssetCsvRow[]) {
  const cell = (v: string | number | null) => {
    if (v === null) return "";
    const text = String(v);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const group = (key: string) => findAssetGroup(key);
  const header = [
    "기준일",
    "구성원",
    "투자 이름",
    "증권사",
    "자산그룹",
    "상위그룹",
    "통화종류",
    "자산종류",
    "금액",
    "수량",
    "수익금",
    "수익률",
  ];
  const currency = { KRW: "원화", USD: "달러", NONE: "-" } as const;
  const risk = { RISKY: "위험", SAFE: "안전" } as const;
  return (
    "\uFEFF" +
    [
      header.join(","),
      ...rows.map((r) => {
        const g = group(r.group_key);
        return [
          r.as_of,
          r.owner_name,
          r.name,
          r.broker,
          g?.name ?? r.group_key,
          g?.parent ?? "",
          g ? currency[g.currency] : "",
          g?.risk ? risk[g.risk] : "-",
          r.amount,
          r.quantity,
          r.profit,
          r.profit_rate === null
            ? null
            : `${(r.profit_rate * 100).toFixed(2)}%`,
        ]
          .map(cell)
          .join(",");
      }),
    ].join("\n") +
    "\n"
  );
}
