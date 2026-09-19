// docs/assert-management/sample_raw_data2.csv를 자산 그룹으로 묶어 스냅샷 1건으로 저장한다.
// 일회성 초기 적재용이며 MCP를 거치지 않고 앱의 execute()를 그대로 쓴다.
// 사용: tsx scripts/seed-assets.ts --owner <이름> --as-of YYYY-MM-DD [--apply]
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
config({ path: process.env.ASSET_SEED_ENV ?? ".env.local", quiet: true });

// 규칙은 금융상품과 국내 ETF만 확정한다. 개별 종목은 상장 거래소를 알아야 하므로 여기서 명시한다.
const listedOverrides: Record<string, string> = {
  삼성전자: "kr_stock",
  한국금융지주우: "kr_stock",
  한국금융지주: "kr_stock",
  카카오: "kr_stock",
  SK텔레콤: "kr_stock",
  신한지주: "kr_stock",
  SK스퀘어: "kr_stock",
  NAVER: "kr_stock",
  현대차2우B: "kr_stock",
  코카콜라: "foreign_equity",
  "알파벳 A": "foreign_equity",
  "넥스트에라 에너지": "foreign_equity",
  "제이피모간 체이스": "foreign_equity",
  "월트 디즈니": "foreign_equity",
};
// raw 데이터는 증권사 계좌만 담고 있다. 계좌 밖 자산은 사용자가 지정한 값으로 더한다.
const manual: {
  group_key: string;
  amount: number;
  label: string;
  quantity: null;
  profit: null;
  profit_rate: null;
}[] = [
  {
    group_key: "deposit",
    amount: 50000000,
    label: "예적금(직접 입력)",
    quantity: null,
    profit: null,
    profit_rate: null,
  },
  {
    group_key: "cash",
    amount: 12000000,
    label: "현금(직접 입력)",
    quantity: null,
    profit: null,
    profit_rate: null,
  },
];
function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
async function main() {
  const {
    classifyAsset,
    assetGroups,
    assetGroupName,
    findAssetGroup,
    assetRulesVersion,
  } = await import("../src/lib/assets");
  const { actorForUser } = await import("../src/server/security");
  const { execute } = await import("../src/server/service");
  const { query, getPool } = await import("../src/server/db");

  const ownerName = arg("owner");
  const asOf = arg("as-of");
  const apply = process.argv.includes("--apply");
  if (!ownerName || !asOf?.match(/^\d{4}-\d{2}-\d{2}$/))
    throw Error("사용법: --owner <이름> --as-of YYYY-MM-DD [--apply]");

  const rows = readFileSync(
    "docs/assert-management/sample_raw_data2.csv",
    "utf8",
  )
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [name, broker, amount, quantity, profit, rate] = line.split(",");
      const num = (v: string | undefined) =>
        v && v.trim() !== "" ? Number(v) : null;
      return {
        name: name.trim(),
        broker: broker.trim(),
        amount: Number(amount),
        quantity: num(quantity),
        profit: num(profit),
        // 원본은 1.94% 형태다. 저장은 비율로 통일한다.
        profit_rate: rate?.trim()
          ? Number((Number(rate.replace("%", "")) / 100).toFixed(6))
          : null,
      };
    });

  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const unresolved: string[] = [];
  const classified = rows.map((row) => {
    const key = listedOverrides[row.name] ?? classifyAsset(row.name).group_key;
    if (key === "unclassified") unresolved.push(row.name);
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { ...row, group_key: key };
  });
  for (const m of manual) {
    totals.set(m.group_key, (totals.get(m.group_key) ?? 0) + m.amount);
    counts.set(m.group_key, (counts.get(m.group_key) ?? 0) + 1);
  }
  if (unresolved.length)
    throw Error(`분류하지 못한 자산이 있습니다: ${unresolved.join(", ")}`);

  const items = [
    ...classified.map((r) => ({
      group_key: r.group_key,
      name: r.name,
      broker: r.broker,
      amount: r.amount,
      quantity: r.quantity,
      profit: r.profit,
      profit_rate: r.profit_rate,
    })),
    ...manual.map((m) => ({
      group_key: m.group_key,
      name: m.label,
      broker: "",
      amount: m.amount,
      quantity: null,
      profit: null,
      profit_rate: null,
    })),
  ];
  const total = items.reduce((n, i) => n + i.amount, 0);
  const csvTotal = rows.reduce((n, r) => n + r.amount, 0);
  const manualTotal = manual.reduce((n, m) => n + m.amount, 0);
  if (total !== csvTotal + manualTotal) throw Error("합계가 맞지 않습니다.");

  const url = new URL(process.env.DATABASE_URL!);
  console.log(`DB   ${url.hostname}${url.pathname}`);
  console.log(`대상 ${ownerName} · ${asOf}`);
  console.log(
    `원본 ${rows.length}행 ${csvTotal.toLocaleString("ko-KR")}원 + 직접 입력 ${manualTotal.toLocaleString("ko-KR")}원`,
  );
  for (const [group_key, amount] of totals)
    console.log(
      `  ${assetGroupName(group_key).padEnd(14)} ${amount.toLocaleString("ko-KR").padStart(13)}원  ${((amount / total) * 100).toFixed(1).padStart(5)}%`,
    );
  console.log(
    `  ${"합계".padEnd(14)} ${total.toLocaleString("ko-KR").padStart(13)}원`,
  );

  const currency = { KRW: "원화", USD: "달러", NONE: "-" } as const;
  const risk = { RISKY: "위험", SAFE: "안전" } as const;
  // 그룹화 결과를 원본 CSV 옆에 남긴다. 사람이 분류를 확인하는 용도다.
  writeFileSync(
    "docs/assert-management/grouped_data.csv",
    "자산그룹,통화종류,자산종류,금액,비중,항목수\n" +
      assetGroups
        .filter((g) => totals.has(g.key))
        .map((g) => {
          const amount = totals.get(g.key)!;
          return [
            g.name,
            currency[g.currency],
            g.risk ? risk[g.risk] : "-",
            amount,
            ((amount / total) * 100).toFixed(1) + "%",
            counts.get(g.key),
          ].join(",");
        })
        .join("\n") +
      `\n합계,-,-,${total},100.0%,${[...counts.values()].reduce((n, v) => n + v, 0)}\n`,
    "utf8",
  );
  writeFileSync(
    "docs/assert-management/grouped_raw_data.csv",
    "투자 이름,증권사,금액,자산그룹,통화종류,자산종류\n" +
      [
        ...classified.map((r) => [r.name, r.broker, r.amount, r.group_key]),
        ...manual.map((m) => [m.label, "", m.amount, m.group_key]),
      ]
        .map(([name, broker, amount, key]) => {
          const g = findAssetGroup(String(key))!;
          return [
            name,
            broker,
            amount,
            g.name,
            currency[g.currency],
            g.risk ? risk[g.risk] : "-",
          ].join(",");
        })
        .join("\n") +
      "\n",
    "utf8",
  );
  console.log(
    "\ndocs/assert-management/grouped_data.csv, grouped_raw_data.csv 를 만들었습니다.",
  );

  if (!apply) {
    console.log("\n--apply 없이 실행해 저장하지 않았습니다.");
    await getPool().end();
    return;
  }
  const [member] = await query(
    'SELECT m.user_id FROM household_members m JOIN "user" u ON u.id=m.user_id WHERE m.active=true AND u.email=$1',
    [process.env.OWNER_EMAIL],
  );
  if (!member) throw Error("OWNER_EMAIL에 해당하는 활성 구성원이 없습니다.");
  const actor = await actorForUser(member.user_id, "web");

  const [existing] = await query(
    "SELECT id FROM asset_owners WHERE household_id=$1 AND name=$2",
    [actor.householdId, ownerName],
  );
  const person =
    existing ??
    ((await execute(actor, "asset_save_owner", {
      idempotency_key: randomUUID(),
      name: ownerName,
    })) as { id: string });

  const saved = (await execute(actor, "asset_record_snapshot", {
    idempotency_key: randomUUID(),
    owner_id: person.id,
    as_of: asOf,
    rules_version: assetRulesVersion,
    note: "sample_raw_data2.csv 초기 적재 + 예적금·현금 직접 입력",
    items,
  })) as Record<string, unknown>;
  console.log(
    `\n저장했습니다. snapshot=${saved.id} version=${saved.version} replaced=${saved.replaced} total=${Number(saved.total).toLocaleString("ko-KR")}원`,
  );
  await getPool().end();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "적재 실패");
  process.exit(1);
});
