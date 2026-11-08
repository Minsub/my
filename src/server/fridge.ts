import type { PoolClient } from "pg";
import { query } from "./db";
import { AppError, requireScope } from "./security";
import { today } from "@/lib/format";
import {
  splitFridgeNames,
  type FridgeFrequent,
  type FridgeItem,
  type FridgeKind,
  type FridgePlace,
  type FridgeState,
} from "@/lib/fridge";
import type { Actor } from "@/lib/types";

// 취미 / 냉장고 저장·조회. 쓰기는 execute(공통 명령) 안의 트랜잭션에서 부른다.
// 냉장고는 구성원이 같이 쓰므로 넣은 사람과 관계없이 공간 안의 누구나 빼고 옮긴다.
const COLUMNS = "id::text AS id, name, place, kind, added_on, version";
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

const cleanName = (name: string) => splitFridgeNames(name)[0] ?? "";
export async function addFridgeItems(
  client: PoolClient,
  actor: Actor,
  input: { place: FridgePlace; items: { name: string; kind: FridgeKind }[] },
) {
  // 같은 이름을 두 번 적었으면 처음 것만 남긴다.
  const seen = new Set<string>();
  const items = input.items
    .map((i) => ({ name: cleanName(i.name), kind: i.kind }))
    .filter((i) => i.name && !seen.has(i.name) && seen.add(i.name));
  if (!items.length)
    throw new AppError("INVALID_INPUT", "넣을 이름을 적어주세요.");
  return query<FridgeItem>(
    `INSERT INTO fridge_items(household_id,name,kind,place,added_on,created_by,updated_by)
     SELECT $1, n, k, $4, $5::date, $6, $6
     FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS t(n, k, i) ORDER BY i
     RETURNING ${COLUMNS}`,
    [
      actor.householdId,
      items.map((i) => i.name),
      items.map((i) => i.kind),
      input.place,
      today(),
      actor.userId,
    ],
    client,
  );
}
// 이름·종류 고치기(재료를 눌러 여는 시트). 칸은 끌어서 옮기고, 넣은 날은 바꾸지 않는다.
export async function updateFridgeItem(
  client: PoolClient,
  actor: Actor,
  input: Ref & { name: string; kind: FridgeKind },
) {
  const row = await lockItem(client, actor, input);
  if (row.removed)
    throw new AppError("ALREADY_REMOVED", "이미 뺀 재료입니다.", 409);
  const name = cleanName(input.name);
  if (!name) throw new AppError("INVALID_INPUT", "이름을 적어주세요.");
  return bump(client, actor, input.id, "name=$4, kind=$5", [name, input.kind]);
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

// 냉장고에 있는 것 전체(오래 둔 순), 자주 넣는 것, 이번 달 버린 수.
// 자주 넣는 것: 최근 180일에 넣은 횟수가 많은 이름(같으면 최근에 넣은 순) 12개. 지금 냉장고에
// 있는 이름은 뺀다. 종류·칸은 마지막으로 넣었을 때 값을 쓴다. 따로 즐겨찾기를 두지 않는다.
export async function listFridge(actor: Actor): Promise<FridgeState> {
  requireScope(actor, "meal:read");
  const [items, frequent, [wasted]] = await Promise.all([
    query<FridgeItem>(
      `SELECT ${COLUMNS} FROM fridge_items WHERE household_id=$1 AND removed IS NULL
       ORDER BY added_on, created_at, name`,
      [actor.householdId],
    ),
    query<FridgeFrequent>(
      `SELECT name, kind, place FROM (
         SELECT DISTINCT ON (name) name, kind, place,
           count(*) OVER (PARTITION BY name) AS times, created_at
         FROM fridge_items
         WHERE household_id=$1 AND created_at > now() - interval '180 days'
         ORDER BY name, created_at DESC
       ) f
       WHERE NOT EXISTS (SELECT 1 FROM fridge_items i WHERE i.household_id=$1 AND i.removed IS NULL AND i.name=f.name)
       ORDER BY times DESC, created_at DESC LIMIT 12`,
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
    frequent,
    wasted_this_month: wasted?.count ?? 0,
  };
}
