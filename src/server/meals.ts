import type { PoolClient } from "pg";
import { query } from "./db";
import { AppError, requireScope } from "./security";
import { cleanMealWords, mealTitleKey, type MealDish } from "@/lib/meals";
import type { Actor } from "@/lib/types";

// 취미 / 집밥 저장·조회. 쓰기는 execute(공통 명령) 안의 트랜잭션에서 부른다.
const COLUMNS = `d.id::text AS id, d.title, d.category, d.ingredients, d.tags, d.links,
  d.memo, d.want_to_try, d.version, d.created_by, u.name AS created_by_name,
  d.created_at, d.updated_at`;
type Row = Omit<MealDish, "created_at" | "updated_at"> & {
  created_at: Date;
  updated_at: Date;
};
const toDish = (r: Row): MealDish => ({
  ...r,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});
export type MealInput = {
  title: string;
  category: string;
  ingredients: string[];
  tags: string[];
  links: string[];
  memo: string;
  want_to_try: boolean;
};
function normalize(input: MealInput) {
  const title = input.title.normalize("NFC").replace(/\s+/g, " ").trim();
  const ingredients = cleanMealWords(input.ingredients);
  if (!ingredients.length)
    throw new AppError("INVALID_INPUT", "메인 재료를 하나 이상 적어주세요.");
  return {
    title,
    title_key: mealTitleKey(title),
    category: input.category,
    ingredients,
    tags: cleanMealWords(input.tags),
    links: [...new Set(input.links.map((l) => l.trim()))],
    memo: input.memo,
    want_to_try: input.want_to_try,
  };
}
async function duplicateError(
  client: PoolClient,
  actor: Actor,
  titleKey: string,
  exceptId: string | null,
) {
  const [row] = await query<{ id: string; title: string }>(
    "SELECT id::text AS id,title FROM meal_dishes WHERE household_id=$1 AND title_key=$2 AND ($3::uuid IS NULL OR id<>$3::uuid)",
    [actor.householdId, titleKey, exceptId],
    client,
  );
  return row
    ? new AppError(
        "DUPLICATE_TITLE",
        `이미 있는 요리입니다: ${row.title} (id ${row.id}). 같은 요리면 그 요리를 고쳐주세요.`,
        409,
      )
    : null;
}
async function readOne(client: PoolClient, actor: Actor, id: string) {
  const [row] = await query<Row>(
    `SELECT ${COLUMNS} FROM meal_dishes d LEFT JOIN "user" u ON u.id=d.created_by
     WHERE d.household_id=$1 AND d.id=$2`,
    [actor.householdId, id],
    client,
  );
  return toDish(row);
}
async function lockOwned(
  client: PoolClient,
  actor: Actor,
  id: string,
  version: number,
) {
  const [row] = await query<{
    title: string;
    created_by: string;
    version: number;
  }>(
    "SELECT title,created_by,version FROM meal_dishes WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "요리를 찾을 수 없습니다.", 404);
  if (actor.role !== "owner" && row.created_by !== actor.userId)
    throw new AppError(
      "FORBIDDEN",
      "추가한 사람 또는 관리자만 고칠 수 있습니다.",
      403,
    );
  if (row.version !== version)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 변경되었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  return row;
}
export async function createMeal(
  client: PoolClient,
  actor: Actor,
  input: MealInput,
) {
  const d = normalize(input);
  const [row] = await query<{ id: string }>(
    `INSERT INTO meal_dishes(household_id,title,title_key,category,ingredients,tags,links,memo,want_to_try,created_by,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     ON CONFLICT(household_id,title_key) DO NOTHING RETURNING id::text AS id`,
    [
      actor.householdId,
      d.title,
      d.title_key,
      d.category,
      d.ingredients,
      d.tags,
      d.links,
      d.memo,
      d.want_to_try,
      actor.userId,
    ],
    client,
  );
  if (!row)
    throw (
      (await duplicateError(client, actor, d.title_key, null)) ??
      new AppError("DUPLICATE_TITLE", "이미 있는 요리입니다.", 409)
    );
  return readOne(client, actor, row.id);
}
export async function updateMeal(
  client: PoolClient,
  actor: Actor,
  input: MealInput & { id: string; expected_version: number },
) {
  await lockOwned(client, actor, input.id, input.expected_version);
  const d = normalize(input);
  const dup = await duplicateError(client, actor, d.title_key, input.id);
  if (dup) throw dup;
  await query(
    `UPDATE meal_dishes SET title=$3,title_key=$4,category=$5,ingredients=$6,tags=$7,links=$8,memo=$9,
       want_to_try=$10,updated_by=$11,updated_at=now(),version=version+1
     WHERE household_id=$1 AND id=$2`,
    [
      actor.householdId,
      input.id,
      d.title,
      d.title_key,
      d.category,
      d.ingredients,
      d.tags,
      d.links,
      d.memo,
      d.want_to_try,
      actor.userId,
    ],
    client,
  );
  return readOne(client, actor, input.id);
}
export async function deleteMeal(
  client: PoolClient,
  actor: Actor,
  input: { id: string; expected_version: number },
) {
  const row = await lockOwned(client, actor, input.id, input.expected_version);
  await query(
    "DELETE FROM meal_dishes WHERE household_id=$1 AND id=$2",
    [actor.householdId, input.id],
    client,
  );
  return { deleted: true, id: input.id, title: row.title };
}
// 공간의 요리 전체를 최근 추가 순으로 읽는다. 개인 목록이라 페이지 없이 한 번에 읽고
// 거르기는 lib/meals.ts의 filterMeals로 웹·MCP가 똑같이 한다.
export async function listMeals(actor: Actor): Promise<MealDish[]> {
  requireScope(actor, "meal:read");
  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM meal_dishes d LEFT JOIN "user" u ON u.id=d.created_by
     WHERE d.household_id=$1 ORDER BY d.created_at DESC, d.title`,
    [actor.householdId],
  );
  return rows.map(toDish);
}
