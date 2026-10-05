import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import {
  assetPlanHoldingGroups,
  type AssetPlan,
  type AssetPlanHolding,
  type AssetPlanItem,
  type AssetPlanKind,
  type AssetPlansView,
} from "@/lib/asset-plans";
import type { Actor } from "@/lib/types";

// 수정은 처음 저장한 사람 또는 관리자만 한다. 자산 기록과 같은 규칙이다.
const canEdit = (actor: Actor, row: { created_by?: unknown }) =>
  actor.role === "owner" || row.created_by === actor.userId;

export async function readAssetBuyPlans(actor: Actor): Promise<AssetPlansView> {
  requireScope(actor, "asset:read");
  return transaction(async (client) => {
    const owners = await query<{ id: string; name: string }>(
      "SELECT id,name FROM asset_owners WHERE household_id=$1 AND active ORDER BY sort_order,name",
      [actor.householdId],
      client,
    );
    const rows = await query<{
      id: string;
      owner_id: string;
      kind: AssetPlanKind;
      amount: number;
      months: number | null;
      version: number;
      created_by: string;
      updated_at: string;
    }>(
      "SELECT id,owner_id,kind,amount::float8 AS amount,months,version,created_by,updated_at FROM asset_buy_plans WHERE household_id=$1",
      [actor.householdId],
      client,
    );
    const items = await query<AssetPlanItem & { plan_id: string }>(
      "SELECT plan_id,name,code,market,weight::float8 AS weight,isa FROM asset_buy_plan_items WHERE household_id=$1 ORDER BY plan_id,position",
      [actor.householdId],
      client,
    );
    const plans: AssetPlan[] = rows.map((row) => ({
      id: row.id,
      owner_id: row.owner_id,
      kind: row.kind,
      amount: row.amount,
      months: row.months,
      version: row.version,
      editable: canEdit(actor, row),
      updated_at: new Date(row.updated_at).toISOString(),
      items: items
        .filter((i) => i.plan_id === row.id)
        .map(({ name, code, market, weight, isa }) => ({
          name,
          code,
          market,
          weight,
          isa,
        })),
    }));
    // 구성원마다 가장 최근 기록 한 건의 주식 종목. 기록 주기가 달라도 각자의 지금 보유를 쓴다.
    const holdings = await query<AssetPlanHolding>(
      `WITH latest AS (
         SELECT DISTINCT ON (s.owner_id) s.id, s.owner_id
         FROM asset_snapshots s JOIN asset_owners o ON o.household_id=s.household_id AND o.id=s.owner_id
         WHERE s.household_id=$1 AND o.active
         ORDER BY s.owner_id, s.as_of DESC
       )
       SELECT i.name, min(i.group_key) AS group_key, sum(i.amount)::float8 AS amount,
              array_agg(DISTINCT l.owner_id::text) AS owner_ids
       FROM asset_snapshot_items i JOIN latest l ON l.id=i.snapshot_id
       WHERE i.household_id=$1 AND i.group_key=ANY($2::text[])
       GROUP BY i.name ORDER BY amount DESC LIMIT 300`,
      [actor.householdId, assetPlanHoldingGroups],
      client,
    );
    return { owners, plans, holdings };
  });
}

export async function saveAssetBuyPlan(
  client: PoolClient,
  actor: Actor,
  input: {
    owner_id: string;
    kind: AssetPlanKind;
    expected_version: number | null;
    amount: number;
    months: number | null;
    items: AssetPlanItem[];
  },
) {
  const [owner] = await query<{ id: string; name: string; active: boolean }>(
    "SELECT id,name,active FROM asset_owners WHERE household_id=$1 AND id=$2 FOR SHARE",
    [actor.householdId, input.owner_id],
    client,
  );
  if (!owner)
    throw new AppError("NOT_FOUND", "자산 소유자를 찾을 수 없습니다.", 404);
  if (!owner.active)
    throw new AppError(
      "INVALID_INPUT",
      "비활성 소유자의 전략은 바꿀 수 없습니다.",
    );
  const [existing] = await query(
    "SELECT * FROM asset_buy_plans WHERE household_id=$1 AND owner_id=$2 AND kind=$3 FOR UPDATE",
    [actor.householdId, owner.id, input.kind],
    client,
  );
  // 처음 저장(null)인데 이미 있거나, 고치는데 버전이 다르면 다른 곳에서 먼저 바꾼 것이다.
  if ((existing?.version ?? null) !== input.expected_version)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 전략이 변경되었습니다. 새로고침 후 다시 저장해주세요.",
      409,
    );
  if (existing && !canEdit(actor, existing))
    throw new AppError(
      "FORBIDDEN",
      "처음 저장한 사람 또는 관리자만 수정할 수 있습니다.",
      403,
    );
  const [plan] = existing
    ? await query(
        "UPDATE asset_buy_plans SET amount=$3,months=$4,updated_by=$5,updated_at=now(),version=version+1 WHERE household_id=$1 AND id=$2 RETURNING id,version",
        [
          actor.householdId,
          existing.id,
          input.amount,
          input.months,
          actor.userId,
        ],
        client,
      )
    : await query(
        "INSERT INTO asset_buy_plans(household_id,owner_id,kind,amount,months,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id,version",
        [
          actor.householdId,
          owner.id,
          input.kind,
          input.amount,
          input.months,
          actor.userId,
        ],
        client,
      );
  await query(
    "DELETE FROM asset_buy_plan_items WHERE household_id=$1 AND plan_id=$2",
    [actor.householdId, plan.id],
    client,
  );
  for (const [position, item] of input.items.entries())
    await query(
      "INSERT INTO asset_buy_plan_items(household_id,plan_id,position,name,code,market,weight,isa) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        actor.householdId,
        plan.id,
        position,
        item.name.normalize("NFC"),
        item.code,
        item.market,
        item.weight,
        item.isa,
      ],
      client,
    );
  return {
    id: plan.id as string,
    version: plan.version as number,
    owner: { id: owner.id, name: owner.name },
    kind: input.kind,
  };
}
