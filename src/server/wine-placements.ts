import type { PoolClient } from "pg";
import { query } from "./db";
import { AppError } from "./security";
import { CELLAR_SHELF_CAPACITY, type ShelfCount } from "@/lib/wine-cellar";
import type { Actor } from "@/lib/types";
// 셀러 위치 규칙. 와인별 합계 ≤ 재고, 층별 합계 ≤ 층 용량.
// 호출하는 쪽이 먼저 와인 행을 FOR UPDATE로 잠근 뒤 셀러 잠금을 잡는다(항상 와인 → 셀러 순서).
// 층 용량은 여러 와인에 걸친 조건이라 행 잠금만으로는 막을 수 없어 공간 단위 advisory lock을 쓴다.
async function lockCellar(client: PoolClient, actor: Actor) {
  await query(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    [`wine_cellar:${actor.householdId}`],
    client,
  );
}
async function shelvesOf(client: PoolClient, actor: Actor, wineId: string) {
  return query<ShelfCount>(
    "SELECT shelf::int,quantity FROM wine_cellar_placements WHERE household_id=$1 AND wine_id=$2 ORDER BY shelf",
    [actor.householdId, wineId],
    client,
  );
}
const key = (rows: ShelfCount[]) =>
  [...rows]
    .sort((a, b) => a.shelf - b.shelf)
    .map((r) => `${r.shelf}:${r.quantity}`)
    .join(",");
async function writeShelf(
  client: PoolClient,
  actor: Actor,
  wineId: string,
  shelf: number,
  quantity: number,
) {
  if (quantity > 0)
    // 이미 있던 층은 placed_at을 유지해 셀러 화면에서 병 순서가 바뀌지 않게 한다.
    await query(
      "INSERT INTO wine_cellar_placements(household_id,wine_id,shelf,quantity,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(household_id,wine_id,shelf) DO UPDATE SET quantity=EXCLUDED.quantity,updated_by=EXCLUDED.updated_by",
      [actor.householdId, wineId, shelf, quantity, actor.userId],
      client,
    );
  else
    await query(
      "DELETE FROM wine_cellar_placements WHERE household_id=$1 AND wine_id=$2 AND shelf=$3",
      [actor.householdId, wineId, shelf],
      client,
    );
}
export async function setWinePlacement(
  client: PoolClient,
  actor: Actor,
  wine: { id: string; archived: boolean },
  stock: number,
  input: { expected_placements: ShelfCount[]; placements: ShelfCount[] },
) {
  await lockCellar(client, actor);
  const current = await shelvesOf(client, actor, wine.id);
  if (key(current) !== key(input.expected_placements))
    throw new AppError(
      "VERSION_CONFLICT",
      "그 사이 셀러 위치가 바뀌었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  const placed = input.placements.reduce((sum, p) => sum + p.quantity, 0);
  if (wine.archived && placed > 0)
    throw new AppError("ARCHIVED", "보관한 와인은 셀러에 넣을 수 없습니다.");
  if (placed > stock)
    throw new AppError(
      "INVALID_INPUT",
      `보유 ${stock}병보다 많이 넣을 수 없습니다.`,
    );
  const changed = input.placements.filter(
    (p) => current.find((c) => c.shelf === p.shelf)?.quantity !== p.quantity,
  );
  if (changed.length) {
    const others = await query<{ shelf: number; total: number }>(
      "SELECT shelf::int,sum(quantity)::int AS total FROM wine_cellar_placements WHERE household_id=$1 AND wine_id<>$2 AND shelf=ANY($3::int[]) GROUP BY shelf",
      [actor.householdId, wine.id, changed.map((p) => p.shelf)],
      client,
    );
    for (const p of changed) {
      const used = others.find((o) => o.shelf === p.shelf)?.total ?? 0;
      if (used + p.quantity > CELLAR_SHELF_CAPACITY)
        throw new AppError(
          "SHELF_FULL",
          `${p.shelf}층에는 ${Math.max(0, CELLAR_SHELF_CAPACITY - used)}병만 더 넣을 수 있습니다.`,
          409,
        );
    }
  }
  for (const c of current)
    if (!input.placements.some((p) => p.shelf === c.shelf))
      await writeShelf(client, actor, wine.id, c.shelf, 0);
  for (const p of changed)
    await writeShelf(client, actor, wine.id, p.shelf, p.quantity);
  return { wine_id: wine.id, placements: input.placements, stock, placed };
}
// 재고가 taken병 줄어 newStock이 됐을 때 셀러에서 뺄 병을 정한다.
// shelf를 주면 그 층에서 먼저 빼고(그 층에 있는 만큼), 나머지는 자리 없는 병에서 나간 것으로 본다.
// 그래도 셀러에 든 병이 재고보다 많으면 한 층에만 있을 때 그 층에서 빼고, 여러 층이면 어느 층인지 묻는다.
export async function releaseForStockDrop(
  client: PoolClient,
  actor: Actor,
  wineId: string,
  taken: number,
  newStock: number,
  shelf?: number,
  ambiguousMessage = "셀러 여러 층에 있는 와인입니다. 어느 층에서 꺼냈는지 골라주세요.",
) {
  await lockCellar(client, actor);
  const rows = await shelvesOf(client, actor, wineId);
  const released: ShelfCount[] = [];
  const take = (row: ShelfCount, n: number) => {
    if (n <= 0) return;
    row.quantity -= n;
    const prior = released.find((r) => r.shelf === row.shelf);
    if (prior) prior.quantity += n;
    else released.push({ shelf: row.shelf, quantity: n });
  };
  if (shelf !== undefined) {
    const row = rows.find((r) => r.shelf === shelf);
    if (!row)
      throw new AppError("INVALID_INPUT", `${shelf}층에는 이 와인이 없습니다.`);
    take(row, Math.min(taken, row.quantity));
  }
  const overflow =
    rows.reduce((sum, r) => sum + r.quantity, 0) - Math.max(0, newStock);
  if (overflow > 0) {
    const left = rows.filter((r) => r.quantity > 0);
    if (left.length !== 1)
      throw new AppError("SHELF_REQUIRED", ambiguousMessage, 409);
    take(left[0], overflow);
  }
  for (const r of released) {
    const row = rows.find((x) => x.shelf === r.shelf)!;
    await writeShelf(client, actor, wineId, row.shelf, row.quantity);
  }
  return released;
}
