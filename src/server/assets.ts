import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import {
  assetGroupName,
  assetRulesVersion,
  assetCagr,
  assetStockBoardGroups,
  axisBucketOf,
  buildAssetSummary,
  buildAssetStockBoards,
  buildAssetTimeline,
  periodOf,
  sliceTimeline,
  type AssetAxis,
  type AssetStockBoard,
  type AssetRange,
  type AssetPeriod,
  type AssetLinePoint,
  type AssetOwner,
  type AssetSummary,
  type AssetTimelinePoint,
} from "@/lib/assets";
import type { Actor } from "@/lib/types";

// 금액은 bigint다. pg는 int8을 문자열로 돌려주므로 조회에서 float8로 캐스팅한다.
// 상한 1조는 2^53보다 작아 부동소수점으로도 정확하다.
const AMOUNT = "i.amount::float8 AS amount";
const ITEM_COLUMNS = `i.id::text AS id, i.position, i.group_key, i.name, i.broker,
  i.amount::float8 AS amount, i.quantity::float8 AS quantity,
  i.profit::float8 AS profit, i.profit_rate::float8 AS profit_rate`;
const isDate = (v: string | undefined) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
type Owned = { created_by?: unknown };
const canEdit = (actor: Actor, row: Owned) =>
  actor.role === "owner" || row.created_by === actor.userId;
function assertCanEdit(actor: Actor, row: Owned) {
  if (!canEdit(actor, row))
    throw new AppError(
      "FORBIDDEN",
      "등록한 사람 또는 관리자만 수정할 수 있습니다.",
      403,
    );
}
export async function listAssetOwners(
  actor: Actor,
  client?: PoolClient,
): Promise<AssetOwner[]> {
  return query<AssetOwner>(
    "SELECT id,name,user_id,sort_order,active,version,created_by FROM asset_owners WHERE household_id=$1 ORDER BY sort_order,name",
    [actor.householdId],
    client,
  );
}
async function resolveOwner(
  client: PoolClient,
  actor: Actor,
  input: { owner_id?: string; owner_name?: string },
) {
  const [row] = input.owner_id
    ? await query(
        "SELECT * FROM asset_owners WHERE household_id=$1 AND id=$2 FOR UPDATE",
        [actor.householdId, input.owner_id],
        client,
      )
    : await query(
        "SELECT * FROM asset_owners WHERE household_id=$1 AND name=$2 FOR UPDATE",
        [actor.householdId, input.owner_name!.normalize("NFC")],
        client,
      );
  if (!row) {
    const known = (await listAssetOwners(actor, client))
      .filter((o) => o.active)
      .map((o) => o.name);
    throw new AppError(
      "NOT_FOUND",
      known.length
        ? `등록된 자산 소유자가 아닙니다. 현재 소유자: ${known.join(", ")}. 새로 추가하려면 asset_save_owner를 먼저 사용하세요.`
        : "자산 소유자를 먼저 등록해주세요.",
      404,
    );
  }
  if (!row.active)
    throw new AppError(
      "INVALID_INPUT",
      "비활성 소유자에는 기록할 수 없습니다.",
    );
  return row;
}
export async function saveAssetOwner(
  client: PoolClient,
  actor: Actor,
  input: {
    id?: string;
    expected_version?: number;
    name: string;
    link_to_me?: boolean;
    sort_order: number;
    active: boolean;
  },
) {
  const name = input.name.normalize("NFC");
  if (!input.id) {
    const [row] = await query(
      "INSERT INTO asset_owners(household_id,name,user_id,sort_order,active,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        actor.householdId,
        name,
        input.link_to_me ? actor.userId : null,
        input.sort_order,
        input.active,
        actor.userId,
      ],
      client,
    );
    return row;
  }
  const [existing] = await query(
    "SELECT * FROM asset_owners WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, input.id],
    client,
  );
  if (!existing)
    throw new AppError("NOT_FOUND", "소유자를 찾을 수 없습니다.", 404);
  assertCanEdit(actor, existing);
  if (
    input.expected_version !== undefined &&
    existing.version !== input.expected_version
  )
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 변경되었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  const userId =
    input.link_to_me === undefined
      ? existing.user_id
      : input.link_to_me
        ? actor.userId
        : null;
  const [row] = await query(
    "UPDATE asset_owners SET name=$3,user_id=$4,sort_order=$5,active=$6,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
    [actor.householdId, input.id, name, userId, input.sort_order, input.active],
    client,
  );
  return row;
}
// 스냅샷은 그 날짜의 완결된 자산 현황이다. 같은 (소유자, 날짜)는 부분 병합이 아니라 통째로 교체한다.
// 일부 그룹만 보내면 나머지가 사라지므로 결과에 교체 전후 값을 반드시 함께 돌려준다.
export type AssetItemInput = {
  group_key: string;
  name: string;
  broker: string;
  amount: number;
  quantity: number | null;
  profit: number | null;
  profit_rate: number | null;
};
export async function recordAssetSnapshot(
  client: PoolClient,
  actor: Actor,
  input: {
    owner_id?: string;
    owner_name?: string;
    as_of: string;
    expected_version: number | null;
    rules_version: string;
    note: string;
    items: AssetItemInput[];
  },
) {
  const owner = await resolveOwner(client, actor, input);
  const [existing] = await query(
    "SELECT * FROM asset_snapshots WHERE household_id=$1 AND owner_id=$2 AND as_of=$3 FOR UPDATE",
    [actor.householdId, owner.id, input.as_of],
    client,
  );
  if (
    input.expected_version !== null &&
    existing?.version !== input.expected_version
  )
    throw new AppError(
      "VERSION_CONFLICT",
      "이 날짜의 기록이 변경되었습니다. 다시 조회한 뒤 저장해주세요.",
      409,
    );
  if (existing) assertCanEdit(actor, existing);
  const before = new Map<string, number>();
  if (existing)
    for (const row of await query(
      `SELECT i.group_key, ${AMOUNT} FROM asset_snapshot_items i WHERE i.household_id=$1 AND i.snapshot_id=$2`,
      [actor.householdId, existing.id],
      client,
    ))
      before.set(
        row.group_key as string,
        (before.get(row.group_key as string) ?? 0) + (row.amount as number),
      );
  const [snapshot] = await query(
    `INSERT INTO asset_snapshots(household_id,owner_id,as_of,source,rules_version,note,created_by,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT(household_id,owner_id,as_of) DO UPDATE SET
       source=EXCLUDED.source,rules_version=EXCLUDED.rules_version,note=EXCLUDED.note,
       updated_by=EXCLUDED.updated_by,updated_at=now(),version=asset_snapshots.version+1
     RETURNING *`,
    [
      actor.householdId,
      owner.id,
      input.as_of,
      actor.channel === "mcp" ? "mcp" : "web",
      input.rules_version,
      input.note,
      actor.userId,
    ],
    client,
  );
  await query(
    "DELETE FROM asset_snapshot_items WHERE household_id=$1 AND snapshot_id=$2",
    [actor.householdId, snapshot.id],
    client,
  );
  // 0원 항목은 저장하지 않는다. 빠진 그룹은 조회할 때 직전 값과 비교해 0으로 다룬다.
  const items = input.items.filter((i) => i.amount > 0);
  let position = 0;
  for (const item of items)
    await query(
      "INSERT INTO asset_snapshot_items(household_id,snapshot_id,position,group_key,name,broker,amount,quantity,profit,profit_rate) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        actor.householdId,
        snapshot.id,
        position++,
        item.group_key,
        item.name,
        item.broker,
        item.amount,
        item.quantity,
        item.profit,
        item.profit_rate,
      ],
      client,
    );
  const after = new Map<string, number>();
  for (const item of items)
    after.set(item.group_key, (after.get(item.group_key) ?? 0) + item.amount);
  const total = items.reduce((n, i) => n + i.amount, 0);
  const previousTotal = [...before.values()].reduce((n, v) => n + v, 0);
  return {
    id: snapshot.id as string,
    owner: { id: owner.id as string, name: owner.name as string },
    as_of: input.as_of,
    version: snapshot.version as number,
    replaced: Boolean(existing),
    item_count: items.length,
    total,
    previous_total: existing ? previousTotal : null,
    changes: [...new Set([...before.keys(), ...after.keys()])].map(
      (group_key) => {
        const now = after.get(group_key) ?? 0;
        const prior = before.get(group_key) ?? 0;
        return {
          group_key,
          name: assetGroupName(group_key),
          before: existing ? prior : null,
          after: now,
          delta: existing ? now - prior : null,
        };
      },
    ),
  };
}
// 저장된 기록의 한 줄만 고친다. 분류가 틀렸거나 금액에 오타가 난 경우가 실제로 잦은데,
// 그것 때문에 그 날짜 전체를 다시 보내게 하면 나머지 항목이 사라질 위험만 커진다.
// 스냅샷 행을 먼저 잠그고 버전을 확인한 뒤 고친다. 같은 날짜를 다시 저장한 사람과 경쟁하면 거부한다.
export async function updateAssetSnapshotItem(
  client: PoolClient,
  actor: Actor,
  input: {
    snapshot_id: string;
    item_id: string;
    expected_version: number;
    group_key?: string;
    amount?: number;
  },
) {
  const [snapshot] = await query(
    "SELECT * FROM asset_snapshots WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, input.snapshot_id],
    client,
  );
  if (!snapshot)
    throw new AppError("NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  assertCanEdit(actor, snapshot);
  if (snapshot.version !== input.expected_version)
    throw new AppError(
      "VERSION_CONFLICT",
      "이 기록이 변경되었습니다. 다시 조회한 뒤 수정해주세요.",
      409,
    );
  const [item] = await query(
    `SELECT ${ITEM_COLUMNS} FROM asset_snapshot_items i
     WHERE i.household_id=$1 AND i.snapshot_id=$2 AND i.id=$3 FOR UPDATE`,
    [actor.householdId, input.snapshot_id, input.item_id],
    client,
  );
  if (!item) throw new AppError("NOT_FOUND", "항목을 찾을 수 없습니다.", 404);
  const before = {
    group_key: item.group_key as string,
    amount: item.amount as number,
  };
  const after = {
    group_key: input.group_key ?? before.group_key,
    amount: input.amount ?? before.amount,
  };
  await query(
    "UPDATE asset_snapshot_items SET group_key=$4,amount=$5 WHERE household_id=$1 AND snapshot_id=$2 AND id=$3",
    [
      actor.householdId,
      input.snapshot_id,
      input.item_id,
      after.group_key,
      after.amount,
    ],
    client,
  );
  // 항목이 바뀌면 그 날짜의 내용이 바뀐 것이다. 스냅샷 버전을 올려 다음 수정이 최신 값을 보게 한다.
  const [updated] = await query(
    "UPDATE asset_snapshots SET updated_by=$3,updated_at=now(),version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
    [actor.householdId, input.snapshot_id, actor.userId],
    client,
  );
  return {
    snapshot_id: input.snapshot_id,
    item_id: input.item_id,
    as_of: snapshot.as_of as string,
    name: item.name as string,
    version: updated.version as number,
    before: {
      ...before,
      group_name: assetGroupName(before.group_key),
    },
    after: {
      ...after,
      group_name: assetGroupName(after.group_key),
    },
  };
}
export async function deleteAssetSnapshot(
  client: PoolClient,
  actor: Actor,
  id: string,
) {
  const [row] = await query(
    "SELECT * FROM asset_snapshots WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  assertCanEdit(actor, row);
  await query(
    "DELETE FROM asset_snapshots WHERE household_id=$1 AND id=$2",
    [actor.householdId, id],
    client,
  );
  return {
    deleted: true,
    as_of: row.as_of as string,
    owner_id: row.owner_id as string,
  };
}
export type AssetSnapshotRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  as_of: string;
  source: string;
  note: string;
  version: number;
  rules_version: string;
  total: number;
  item_count: number;
  updated_at: string;
  canEdit: boolean;
};
export type AssetItemRow = {
  id: string;
  position: number;
  group_key: string;
  group_name: string;
  name: string;
  broker: string;
  amount: number;
  quantity: number | null;
  profit: number | null;
  profit_rate: number | null;
  owner_id: string;
  owner_name: string;
  as_of: string;
};
export type AssetOverview = {
  owners: (AssetOwner & { linked: boolean })[];
  owner: string;
  period: AssetPeriod;
  range: AssetRange;
  rules_version: string;
  // 한 화면에 모든 축을 같이 보여주므로 축별 시계열을 한 번에 돌려준다.
  timelines: Record<AssetAxis, AssetTimelinePoint[]>;
  summaries: Record<AssetAxis, AssetSummary | null>;
  cagr: number | null;
  currencyMix: { KRW: number; USD: number; NONE: number };
  // 주식 요약 카드용. 최신 기간에 유효한 스냅샷의 원본 종목만 담는다.
  stocks: AssetStockBoard[];
  ownerTotals: {
    owner_id: string;
    name: string;
    as_of: string | null;
    total: number;
    change: number | null;
  }[];
  unclassified: number;
};
const AXES: AssetAxis[] = ["group", "parent", "currency", "risk"];
async function readPoints(
  client: PoolClient,
  actor: Actor,
  ownerIds: string[],
  from?: string,
  to?: string,
): Promise<AssetLinePoint[]> {
  if (!ownerIds.length) return [];
  const rows = await query(
    `SELECT s.as_of, s.owner_id::text AS owner_id, i.group_key, ${AMOUNT}
     FROM asset_snapshots s
     JOIN asset_snapshot_items i ON i.household_id=s.household_id AND i.snapshot_id=s.id
     WHERE s.household_id=$1 AND s.owner_id = ANY($2::uuid[])
       AND ($3::date IS NULL OR s.as_of >= $3) AND ($4::date IS NULL OR s.as_of <= $4)
     ORDER BY s.as_of`,
    [actor.householdId, ownerIds, isDate(from), isDate(to)],
    client,
  );
  return rows.map((r) => ({
    as_of: r.as_of as string,
    owner_id: r.owner_id as string,
    group_key: r.group_key as string,
    amount: r.amount as number,
  }));
}
// 주식 요약 카드는 최신 기간에 실제로 쓰인 스냅샷만 본다.
// 시계열이 고른 (소유자, 기준일) 쌍을 그대로 받아 이월된 구성원도 같은 기준으로 집계한다.
async function readStockBoards(
  client: PoolClient,
  actor: Actor,
  effective: { owner_id: string; as_of: string }[],
  names: Map<string, string>,
): Promise<AssetStockBoard[]> {
  if (!effective.length) return buildAssetStockBoards([]);
  const rows = await query(
    `SELECT s.owner_id::text AS owner_id, i.group_key, i.name, i.broker,
            i.amount::float8 AS amount, i.quantity::float8 AS quantity
     FROM asset_snapshots s
     JOIN asset_snapshot_items i ON i.household_id=s.household_id AND i.snapshot_id=s.id
     WHERE s.household_id=$1 AND i.group_key = ANY($2::text[])
       AND (s.owner_id, s.as_of) IN (SELECT * FROM unnest($3::uuid[], $4::date[]))`,
    [
      actor.householdId,
      [...assetStockBoardGroups],
      effective.map((e) => e.owner_id),
      effective.map((e) => e.as_of),
    ],
    client,
  );
  return buildAssetStockBoards(
    rows.map((r) => ({
      group_key: r.group_key as string,
      name: r.name as string,
      broker: r.broker as string,
      owner_name: names.get(r.owner_id as string) ?? "",
      amount: r.amount as number,
      quantity: r.quantity as number | null,
    })),
  );
}
export async function readAssetOverview(
  actor: Actor,
  params: {
    owner?: string;
    period?: string;
    range?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<AssetOverview> {
  requireScope(actor, "asset:read");
  const period: AssetPeriod = params.period === "year" ? "year" : "month";
  const range = (
    ["1y", "2y", "5y", "all"].includes(params.range ?? "")
      ? params.range
      : "all"
  ) as AssetRange;
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const owners = (await listAssetOwners(actor, client)).map((o) => ({
      ...o,
      linked: o.user_id === actor.userId,
    }));
    // 기록이 없는 소유자를 골라도 화면이 비지 않도록, 고른 소유자를 그대로 유지하고 빈 시계열을 돌려준다.
    const chosen =
      params.owner && params.owner !== "all"
        ? owners.filter((o) => o.id === params.owner)
        : owners.filter((o) => o.active);
    const ownerIds = chosen.map((o) => o.id);
    const points = await readPoints(
      client,
      actor,
      ownerIds,
      params.from,
      params.to,
    );
    const timelines = Object.fromEntries(
      AXES.map((axis) => [
        axis,
        sliceTimeline(
          buildAssetTimeline(points, ownerIds, axis, period),
          period,
          range,
        ),
      ]),
    ) as Record<AssetAxis, AssetTimelinePoint[]>;
    const summaries = Object.fromEntries(
      AXES.map((axis) => [axis, buildAssetSummary(timelines[axis])]),
    ) as Record<AssetAxis, AssetSummary | null>;
    const latestGroup = timelines.group.filter((p) => p.total > 0).at(-1);
    const latestCurrency = timelines.currency.filter((p) => p.total > 0).at(-1);
    const mix = (key: string) =>
      latestCurrency?.buckets.find((b) => b.key === key)?.amount ?? 0;
    const stocks = await readStockBoards(
      client,
      actor,
      latestGroup?.owners ?? [],
      new Map(chosen.map((o) => [o.id, o.name])),
    );
    return {
      owners,
      owner: params.owner && params.owner !== "all" ? params.owner : "all",
      period,
      range,
      rules_version: assetRulesVersion,
      timelines,
      summaries,
      cagr: assetCagr(timelines.group),
      currencyMix: { KRW: mix("KRW"), USD: mix("USD"), NONE: mix("NONE") },
      stocks,
      ownerTotals: chosen.map((o) => {
        const withData = timelines.group.filter((p) => p.total > 0);
        const now = withData.at(-1)?.owners.find((x) => x.owner_id === o.id);
        const then = withData.at(-2)?.owners.find((x) => x.owner_id === o.id);
        return {
          owner_id: o.id,
          name: o.name,
          as_of: now?.as_of ?? null,
          total: now?.amount ?? 0,
          change: now && then ? now.amount - then.amount : null,
        };
      }),
      unclassified:
        latestGroup?.buckets.find((b) => b.key === "unclassified")?.amount ?? 0,
    };
  });
}
// 그래프·표에서 특정 기간의 한 묶음을 눌렀을 때 그 안에 든 원본 항목을 돌려준다.
export async function readAssetItems(
  actor: Actor,
  params: {
    owner?: string;
    period?: string;
    at?: string;
    axis?: string;
    bucket?: string;
  },
): Promise<{ items: AssetItemRow[]; total: number }> {
  requireScope(actor, "asset:read");
  const period: AssetPeriod = params.period === "year" ? "year" : "month";
  const axis = (
    AXES.includes(params.axis as AssetAxis) ? params.axis : "group"
  ) as AssetAxis;
  const at = params.at;
  if (!at?.match(/^\d{4}(-\d{2})?$/))
    throw new AppError("INVALID_INPUT", "조회할 기간을 확인해주세요.");
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const owners = await listAssetOwners(actor, client);
    const chosen =
      params.owner && params.owner !== "all"
        ? owners.filter((o) => o.id === params.owner)
        : owners.filter((o) => o.active);
    const names = new Map(chosen.map((o) => [o.id, o.name]));
    const rows = await query(
      `SELECT s.id::text AS snapshot_id, s.owner_id::text AS owner_id, s.as_of
       FROM asset_snapshots s
       WHERE s.household_id=$1 AND s.owner_id = ANY($2::uuid[])
       ORDER BY s.as_of`,
      [actor.householdId, chosen.map((o) => o.id)],
      client,
    );
    // 시계열과 같은 규칙으로 기간별 유효 스냅샷을 고른다.
    const effective = new Map<string, { id: string; as_of: string }>();
    for (const row of rows)
      if (periodOf(row.as_of as string, period) <= at)
        effective.set(row.owner_id as string, {
          id: row.snapshot_id as string,
          as_of: row.as_of as string,
        });
    if (!effective.size) return { items: [], total: 0 };
    const items = await query(
      `SELECT ${ITEM_COLUMNS}, i.snapshot_id::text AS snapshot_id
       FROM asset_snapshot_items i
       WHERE i.household_id=$1 AND i.snapshot_id = ANY($2::uuid[])
       ORDER BY i.amount DESC`,
      [actor.householdId, [...effective.values()].map((e) => e.id)],
      client,
    );
    const snapshotOwner = new Map(
      [...effective].map(([ownerId, e]) => [e.id, { ownerId, as_of: e.as_of }]),
    );
    const mapped = items
      .filter(
        (i) =>
          !params.bucket ||
          axisBucketOf(i.group_key as string, axis).key === params.bucket,
      )
      .map((i) => {
        const meta = snapshotOwner.get(i.snapshot_id as string)!;
        return {
          id: i.id as string,
          position: i.position as number,
          group_key: i.group_key as string,
          group_name: assetGroupName(i.group_key as string),
          name: i.name as string,
          broker: i.broker as string,
          amount: i.amount as number,
          quantity: i.quantity as number | null,
          profit: i.profit as number | null,
          profit_rate: i.profit_rate as number | null,
          owner_id: meta.ownerId,
          owner_name: names.get(meta.ownerId) ?? "",
          as_of: meta.as_of,
        };
      });
    return {
      items: mapped,
      total: mapped.reduce((n, i) => n + i.amount, 0),
    };
  });
}
// 내보내기는 저장한 원본 항목을 그대로 한 줄씩 준다. 화면 필터나 이월을 적용하지 않는다.
export async function readAssetExport(actor: Actor): Promise<AssetItemRow[]> {
  requireScope(actor, "asset:read");
  const rows = await query(
    `SELECT ${ITEM_COLUMNS}, s.as_of, s.owner_id::text AS owner_id, o.name AS owner_name
     FROM asset_snapshot_items i
     JOIN asset_snapshots s ON s.household_id=i.household_id AND s.id=i.snapshot_id
     JOIN asset_owners o ON o.household_id=s.household_id AND o.id=s.owner_id
     WHERE i.household_id=$1
     ORDER BY s.as_of DESC, o.name, i.position`,
    [actor.householdId],
  );
  return rows.map((i) => ({
    id: i.id as string,
    position: i.position as number,
    group_key: i.group_key as string,
    group_name: assetGroupName(i.group_key as string),
    name: i.name as string,
    broker: i.broker as string,
    amount: i.amount as number,
    quantity: i.quantity as number | null,
    profit: i.profit as number | null,
    profit_rate: i.profit_rate as number | null,
    owner_id: i.owner_id as string,
    owner_name: i.owner_name as string,
    as_of: i.as_of as string,
  }));
}
// 기록 이력 화면이 쓰는 목록. 스냅샷 헤더와 선택한 스냅샷의 원본 항목을 함께 돌려준다.
export async function readAssetHistory(
  actor: Actor,
  params: { snapshot?: string } = {},
): Promise<{
  owners: AssetOwner[];
  snapshots: AssetSnapshotRow[];
  selected: { snapshot: AssetSnapshotRow; items: AssetItemRow[] } | null;
}> {
  requireScope(actor, "asset:read");
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const owners = await listAssetOwners(actor, client);
    const snapshots = (
      await query(
        `SELECT s.id::text AS id, s.owner_id::text AS owner_id, o.name AS owner_name, s.as_of, s.source,
                s.note, s.version, s.rules_version, s.updated_at, s.created_by,
                COALESCE(sum(i.amount),0)::float8 AS total, count(i.id)::int AS item_count
         FROM asset_snapshots s
         JOIN asset_owners o ON o.household_id=s.household_id AND o.id=s.owner_id
         LEFT JOIN asset_snapshot_items i ON i.household_id=s.household_id AND i.snapshot_id=s.id
         WHERE s.household_id=$1
         GROUP BY s.id, o.name
         ORDER BY s.as_of DESC, o.name`,
        [actor.householdId],
        client,
      )
    ).map((r) => ({
      id: r.id as string,
      owner_id: r.owner_id as string,
      owner_name: r.owner_name as string,
      as_of: r.as_of as string,
      source: r.source as string,
      note: r.note as string,
      version: r.version as number,
      rules_version: r.rules_version as string,
      total: r.total as number,
      item_count: r.item_count as number,
      updated_at: r.updated_at as string,
      canEdit: canEdit(actor, r),
    }));
    const target = params.snapshot
      ? snapshots.find((s) => s.id === params.snapshot)
      : snapshots[0];
    if (!target) return { owners, snapshots, selected: null };
    const items = (
      await query(
        `SELECT ${ITEM_COLUMNS} FROM asset_snapshot_items i
         WHERE i.household_id=$1 AND i.snapshot_id=$2 ORDER BY i.position`,
        [actor.householdId, target.id],
        client,
      )
    ).map((i) => ({
      id: i.id as string,
      position: i.position as number,
      group_key: i.group_key as string,
      group_name: assetGroupName(i.group_key as string),
      name: i.name as string,
      broker: i.broker as string,
      amount: i.amount as number,
      quantity: i.quantity as number | null,
      profit: i.profit as number | null,
      profit_rate: i.profit_rate as number | null,
      owner_id: target.owner_id,
      owner_name: target.owner_name,
      as_of: target.as_of,
    }));
    return { owners, snapshots, selected: { snapshot: target, items } };
  });
}
