// 분할매수 전략. 구성원(자산 소유자)마다 매달 무엇을 얼마씩 살지 적어둔다.
// 연금저축·IRP는 모든 구성원이 같은 고정 전략이라 코드 상수로 두고,
// 월급·현금 두 그룹만 구성원별로 DB(asset_buy_plans)에 저장한다.
export type AssetPlanKind = "salary" | "cash";
export type AssetPlanItem = {
  name: string;
  // 종목 코드(티커). 네이버 증권 검색으로 고른 경우만 채워진다. 직접 적은 이름은 비어 있다.
  code: string;
  // 시장 이름(코스피·나스닥 등). 표시용이다.
  market: string;
  // 그룹 금액 대비 비중(%). 소수 둘째 자리까지.
  weight: number;
  // ISA 계좌로 사는 종목인지. 연금저축·IRP 고정 종목은 늘 false다.
  isa: boolean;
};
export type AssetPlan = {
  id: string;
  owner_id: string;
  kind: AssetPlanKind;
  // salary는 매달 투자하는 금액, cash는 나눠서 투자할 총액이다.
  amount: number;
  // cash만 쓴다. 총액을 몇 달에 나눠 사는지.
  months: number | null;
  version: number;
  editable: boolean;
  updated_at: string;
  items: AssetPlanItem[];
};
// 전략에 넣을 종목을 고를 때 보여주는 보유 종목. 구성원마다 가장 최근 자산 기록의 주식 종목이다.
// 같은 이름은 구성원이 달라도 한 줄로 합친다. 자산 기록에는 종목 코드가 없다.
export type AssetPlanHolding = {
  name: string;
  group_key: string;
  amount: number;
  owner_ids: string[];
};
export type AssetPlansView = {
  owners: { id: string; name: string }[];
  plans: AssetPlan[];
  holdings: AssetPlanHolding[];
};
// 보유 종목으로 보여줄 자산 그룹. 국내상장 해외주식(미국 ETF 등)도 사고파는 종목이라 넣는다.
export const assetPlanHoldingGroups = [
  "kr_stock",
  "foreign_equity",
  "kr_listed_foreign_equity",
];
export const assetPlanKinds: {
  key: AssetPlanKind;
  title: string;
  description: string;
}[] = [
  {
    key: "salary",
    title: "월급 분할매수",
    description: "매달 들어오는 수입에서 정한 금액을 나눠 삽니다.",
  },
  {
    key: "cash",
    title: "현금 분할매수",
    description: "가지고 있는 현금을 정한 개월 수에 나눠 삽니다.",
  },
];
export const ASSET_PLAN_MAX_MONTHS = 120;
export const ASSET_PLAN_MAX_ITEMS = 30;
// 모든 구성원이 똑같이 넣는 고정 전략이다. 바꾸려면 이 상수를 고친다.
// 이름은 부르는 대로 적고, 네이버 증권 링크가 정확한 종목을 열도록 코드를 함께 둔다.
export const fixedAssetPlans: {
  key: string;
  title: string;
  amount: number;
  items: AssetPlanItem[];
}[] = [
  {
    key: "pension",
    title: "연금저축",
    amount: 500000,
    items: [
      {
        name: "TIGER S&P500",
        code: "360750",
        market: "코스피",
        weight: 30,
        isa: false,
      },
      {
        name: "RISE 나스닥100",
        code: "368590",
        market: "코스피",
        weight: 30,
        isa: false,
      },
      {
        name: "ACE 미국배당다우존스",
        code: "402970",
        market: "코스피",
        weight: 30,
        isa: false,
      },
      {
        name: "SOL 금융지주플러스고배당",
        code: "484880",
        market: "코스피",
        weight: 10,
        isa: false,
      },
    ],
  },
  {
    key: "irp",
    title: "IRP",
    amount: 250000,
    // 네이버 증권의 RISE TDF2050 ETF는 "RISE TDF2050액티브 적격"(442570) 하나다.
    items: [
      {
        name: "RISE TDF2050액티브",
        code: "442570",
        market: "코스피",
        weight: 100,
        isa: false,
      },
    ],
  },
];
export const fixedAssetPlanTotal = fixedAssetPlans.reduce(
  (n, p) => n + p.amount,
  0,
);
// 비중은 소수 둘째 자리까지 받는다. 합계 비교는 정수(0.01% 단위)로 해서 부동소수점 오차를 피한다.
export const weightUnits = (weight: number) => Math.round(weight * 100);
export const weightSum = (items: { weight: number }[]) =>
  items.reduce((n, i) => n + weightUnits(i.weight), 0) / 100;
export const weightsComplete = (items: { weight: number }[]) =>
  items.reduce((n, i) => n + weightUnits(i.weight), 0) === 10000;
// 현금 분할매수의 한 달 금액. 원 단위로 내림하고, 남는 몇 원은 마지막 달에 붙는다고 본다.
export const monthlyAmount = (plan: {
  kind: AssetPlanKind;
  amount: number;
  months: number | null;
}) =>
  plan.kind === "cash"
    ? Math.floor(plan.amount / Math.max(1, plan.months ?? 1))
    : plan.amount;
export const itemAmount = (amount: number, weight: number) =>
  Math.round((amount * weightUnits(weight)) / 10000);
// 한 달 금액 중 ISA로 사는 종목 몫. 종목별 금액을 반올림해 더하므로 화면의 종목 금액 합과 같다.
export const isaAmount = (amount: number, items: AssetPlanItem[]) =>
  items
    .filter((i) => i.isa)
    .reduce((n, i) => n + itemAmount(amount, i.weight), 0);
// 금액 입력 칸. 쉼표를 넣어 보여주고 숫자만 받는다.
export const digitsOnly = (text: string) => text.replace(/[^0-9]/g, "");
export const groupDigits = (text: string) =>
  text ? new Intl.NumberFormat("ko-KR").format(Number(text)) : "";
