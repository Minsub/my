// 로컬에서 화면을 확인하려고 만드는 가상 자산 기록이다. 민섭·장미 각각 24개월치 1건씩 넣는다.
// 생성기는 src/lib/demo-assets.ts에 있고 /demo 화면과 같은 값을 쓴다.
// 사용: tsx scripts/seed-demo-assets.ts [--apply] [--reset]
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
config({ path: process.env.ASSET_SEED_ENV ?? ".env.local", quiet: true });
async function main() {
  const { demoAssetPlan } = await import("../src/lib/demo-assets");
  const { actorForUser } = await import("../src/server/security");
  const { execute } = await import("../src/server/service");
  const { query, getPool } = await import("../src/server/db");
  const apply = process.argv.includes("--apply");
  const reset = process.argv.includes("--reset");
  const plan = demoAssetPlan();
  const url = new URL(process.env.DATABASE_URL!);
  console.log(`DB   ${url.hostname}${url.pathname}`);
  console.log(
    `생성 ${plan.length}건 · ${new Set(plan.map((s) => s.owner)).size}명 · ${new Set(plan.map((s) => s.as_of.slice(0, 7))).size}개월`,
  );
  const byOwner = new Map<string, number>();
  for (const s of plan)
    byOwner.set(
      s.owner,
      Math.max(byOwner.get(s.owner) ?? 0, 0) +
        (s.as_of === plan.filter((x) => x.owner === s.owner).at(-1)!.as_of
          ? s.items.reduce((n, i) => n + i.amount, 0)
          : 0),
    );
  for (const [owner, total] of byOwner)
    console.log(`  ${owner} 최신 총자산 ${total.toLocaleString("ko-KR")}원`);
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
  if (reset) {
    const removed = await query(
      "DELETE FROM asset_snapshots WHERE household_id=$1 RETURNING id",
      [actor.householdId],
    );
    console.log(`기존 기록 ${removed.length}건을 지웠습니다.`);
  }
  const owners = new Map<string, string>();
  for (const name of new Set(plan.map((s) => s.owner))) {
    const [existing] = await query(
      "SELECT id FROM asset_owners WHERE household_id=$1 AND name=$2",
      [actor.householdId, name],
    );
    owners.set(
      name,
      existing
        ? (existing.id as string)
        : (
            (await execute(actor, "asset_save_owner", {
              idempotency_key: randomUUID(),
              name,
            })) as { id: string }
          ).id,
    );
  }
  let saved = 0;
  for (const snapshot of plan) {
    await execute(actor, "asset_record_snapshot", {
      idempotency_key: randomUUID(),
      owner_id: owners.get(snapshot.owner),
      as_of: snapshot.as_of,
      rules_version: "demo",
      note: "로컬 확인용 가상 기록",
      items: snapshot.items,
    });
    saved++;
  }
  console.log(`\n${saved}건을 저장했습니다.`);
  await getPool().end();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "적재 실패");
  process.exit(1);
});
