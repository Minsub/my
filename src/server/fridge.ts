import type { PoolClient } from "pg";
import { query } from "./db";
import { AppError, requireScope } from "./security";
import { today } from "@/lib/format";
import {
  splitFridgeNames,
  type FridgeItem,
  type FridgePlace,
  type FridgeState,
} from "@/lib/fridge";
import type { Actor } from "@/lib/types";

// 취미 / 냉장고 저장·조회. 쓰기는 execute(공통 명령) 안의 트랜잭션에서 부른다.
// 냉장고는 구성원이 같이 쓰므로 넣은 사람과 관계없이 공간 안의 누구나 빼고 옮긴다.
const COLUMNS = "id::text AS id, name, place, added_on, version";
type Ref = { id: string; expected_version: number };

async function lockItem(
  client: PoolClient,
  actor: Actor,
  { id, expected_version }: Ref,
) {
  const [row] = await query<FridgeItem & { removed: string | null }>(
    `SELECT ${COLUMNS}, removed FROM fridge_items WHERE household_id=$1 AND id=$2 FOR UPDATE`,
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "재료를 찾을 수 없습니다.", 404);
  if (row.version !== expected_version)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 바뀌었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  return row;
}
async function bump(
  client: PoolClient,
  actor: Actor,
  id: string,
  set: string,
  params: unknown[] = [],
) {
  const [row] = await query<FridgeItem>(
    `UPDATE fridge_items SET ${set}, updated_by=$3, updated_at=now(), version=version+1
     WHERE household_id=$1 AND id=$2 RETURNING ${COLUMNS}`,
    [actor.householdId, id, actor.userId, ...params],
    client,
  );
  return row;
}

export async function addFridgeItems(
  client: PoolClient,
  actor: Actor,
  input: { place: FridgePlace; names: string[] },
) {
  const names = splitFridgeNames(input.names.join("\n"));
  if (!names.length)
    throw new AppError("INVALID_INPUT", "넣을 재료 이름을 적어주세요.");
  return query<FridgeItem>(
    `INSERT INTO fridge_items(household_id,name,place,added_on,created_by,updated_by)
     SELECT $1, n, $3, $4::date, $5, $5 FROM unnest($2::text[]) WITH ORDINALITY AS t(n, i) ORDER BY i
     RETURNING ${COLUMNS}`,
    [actor.householdId, names, input.place, today(), actor.userId],
    client,
  );
}
export async function removeFridgeItem(
  client: PoolClient,
  actor: Actor,
  input: Ref & { reason: "eaten" | "wasted" },
) {
  const row = await lockItem(client, actor, input);
  if (row.removed)
    throw new AppError("ALREADY_REMOVED", "이미 뺀 재료입니다.", 409);
  return bump(client, actor, input.id, "removed=$4, removed_at=now()", [
    input.reason,
  ]);
}
// 뺀 재료를 되돌린다(빼자마자 누르는 되돌리기). 넣은 날은 그대로다.
export async function restoreFridgeItem(
  client: PoolClient,
  actor: Actor,
  input: Ref,
) {
  const row = await lockItem(client, actor, input);
  if (!row.removed)
    throw new AppError("NOT_REMOVED", "냉장고에 있는 재료입니다.", 409);
  return bump(client, actor, input.id, "removed=NULL, removed_at=NULL");
}
// 칸 옮기기. 넣은 날은 그대로 둔다.
export async function moveFridgeItem(
  client: PoolClient,
  actor: Actor,
  input: Ref & { place: FridgePlace },
) {
  const row = await lockItem(client, actor, input);
  if (row.removed)
    throw new AppError("ALREADY_REMOVED", "이미 뺀 재료입니다.", 409);
  return bump(client, actor, input.id, "place=$4", [input.place]);
}
// 잘못 넣은 재료를 지운다(넣자마자 누르는 되돌리기). 뺀 기록으로 남기지 않는다.
export async function deleteFridgeItems(
  client: PoolClient,
  actor: Actor,
  input: { items: Ref[] },
) {
  const names: string[] = [];
  for (const ref of input.items) {
    const row = await lockItem(client, actor, ref);
    names.push(row.name);
  }
  await query(
    "DELETE FROM fridge_items WHERE household_id=$1 AND id=ANY($2::uuid[])",
    [actor.householdId, input.items.map((r) => r.id)],
    client,
  );
  return { deleted: names.length, names };
}

// 냉장고에 있는 재료 전체(오래 둔 순)와 최근 다 먹은 이름, 이번 달 버린 수.
export async function listFridge(actor: Actor): Promise<FridgeState> {
  requireScope(actor, "meal:read");
  const [items, recent, [wasted]] = await Promise.all([
    query<FridgeItem>(
      `SELECT ${COLUMNS} FROM fridge_items WHERE household_id=$1 AND removed IS NULL
       ORDER BY added_on, created_at, name`,
      [actor.householdId],
    ),
    query<{ name: string }>(
      `SELECT name FROM (
         SELECT name, max(removed_at) AS last FROM fridge_items
         WHERE household_id=$1 AND removed='eaten' AND removed_at > now() - interval '90 days'
         GROUP BY name
       ) r
       WHERE NOT EXISTS (SELECT 1 FROM fridge_items i WHERE i.household_id=$1 AND i.removed IS NULL AND i.name=r.name)
       ORDER BY last DESC LIMIT 12`,
      [actor.householdId],
    ),
    query<{ count: number }>(
      `SELECT count(*)::int AS count FROM fridge_items
       WHERE household_id=$1 AND removed='wasted'
         AND removed_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`,
      [actor.householdId],
    ),
  ]);
  return {
    items,
    recent: recent.map((r) => r.name),
    wasted_this_month: wasted?.count ?? 0,
  };
}
