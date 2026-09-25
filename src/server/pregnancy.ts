import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, transaction } from "./db";
import { AppError } from "./security";
import { normalizePhoto } from "./wine-photos";
import type { Actor } from "@/lib/types";
import {
  bleedingAmounts,
  bleedingColors,
  MAX_DURATION_MIN,
  MAX_PHOTOS,
  pregnancyKinds,
  type PregnancyData,
  type PregnancyEvent,
} from "@/lib/pregnancy";

// 꼬미 기록은 웹 전용이다. MCP에는 공개하지 않는다.
async function access(actor: Actor, client?: PoolClient) {
  if (actor.channel !== "web")
    throw new AppError(
      "FORBIDDEN",
      "꼬미 기록은 웹에서만 사용할 수 있습니다.",
      403,
    );
  const [row] = await query(
    "SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND active=true",
    [actor.householdId, actor.userId],
    client,
  );
  if (!row) throw new AppError("FORBIDDEN", "접근 권한이 없습니다.", 403);
  return row.role as string;
}
const canEdit = (role: string, actor: Actor, createdBy: string) =>
  role === "owner" || createdBy === actor.userId;

const EVENT_COLUMNS = `e.id, e.kind, e.started_at, e.ended_at, e.intensity, e.bleeding, e.bleeding_color,
  e.memo, e.version, e.created_by, coalesce(u.name,'') AS created_by_name,
  coalesce((SELECT array_agg(p.id::text ORDER BY p.position, p.created_at) FROM pregnancy_photos p
    WHERE p.household_id=e.household_id AND p.event_id=e.id), '{}') AS photo_ids`;
type EventRow = Omit<PregnancyEvent, "started_at" | "ended_at" | "can_edit"> & {
  started_at: Date;
  ended_at: Date | null;
};
const toEvent = (r: EventRow, role: string, actor: Actor): PregnancyEvent => ({
  ...r,
  started_at: r.started_at.toISOString(),
  ended_at: r.ended_at ? r.ended_at.toISOString() : null,
  can_edit: canEdit(role, actor, r.created_by),
});
async function eventById(
  actor: Actor,
  role: string,
  id: string,
  client?: PoolClient,
) {
  const [row] = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM pregnancy_events e LEFT JOIN "user" u ON u.id=e.created_by
     WHERE e.household_id=$1 AND e.id=$2`,
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  return toEvent(row, role, actor);
}

export async function readPregnancy(actor: Actor): Promise<PregnancyData> {
  const role = await access(actor);
  const [settings] = await query(
    "SELECT due_date, version FROM pregnancy_settings WHERE household_id=$1",
    [actor.householdId],
  );
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM pregnancy_events e LEFT JOIN "user" u ON u.id=e.created_by
     WHERE e.household_id=$1 ORDER BY e.started_at DESC LIMIT 5000`,
    [actor.householdId],
  );
  return {
    settings: settings
      ? { due_date: settings.due_date, version: settings.version }
      : { due_date: null, version: 0 },
    events: rows.map((r) => toEvent(r, role, actor)),
  };
}

const iso = z.iso.datetime({ offset: true });
const base64 = z
  .string()
  .min(4)
  .max(2800000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "올바른 사진 데이터가 필요합니다.");
const fields = {
  kind: z.enum(pregnancyKinds),
  started_at: iso,
  ended_at: iso.nullable().optional(),
  intensity: z.number().int().min(1).max(3).nullable().optional(),
  bleeding: z.enum(bleedingAmounts).nullable().optional(),
  bleeding_color: z.enum(bleedingColors).nullable().optional(),
  memo: z.string().max(500).optional(),
};
const createSchema = z
  .object({
    action: z.literal("create"),
    request_key: z.uuid(),
    ...fields,
    photos: z.array(base64).max(MAX_PHOTOS).optional(),
  })
  .strict();
const updateSchema = z
  .object({
    action: z.literal("update"),
    id: z.uuid(),
    expected_version: z.number().int().positive(),
    ...fields,
    keep_photo_ids: z.array(z.uuid()).max(MAX_PHOTOS).optional(),
    photos: z.array(base64).max(MAX_PHOTOS).optional(),
  })
  .strict();
const deleteSchema = z
  .object({
    action: z.literal("delete"),
    id: z.uuid(),
    expected_version: z.number().int().positive(),
  })
  .strict();
const settingsSchema = z
  .object({
    action: z.literal("settings"),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    expected_version: z.number().int().min(0),
  })
  .strict();
export const pregnancyCommand = z.discriminatedUnion("action", [
  createSchema,
  updateSchema,
  deleteSchema,
  settingsSchema,
]);

type Fields = z.infer<typeof createSchema>;
// 타입별로 허용하는 값을 정리하고 시각 범위를 검사한다. DB CHECK와 같은 규칙이다.
function normalize(input: Pick<Fields, keyof typeof fields>) {
  const start = new Date(input.started_at).getTime();
  if (start > Date.now() + 10 * 60000)
    throw new AppError("INVALID_TIME", "미래 시각으로는 기록할 수 없습니다.");
  const memo = (input.memo ?? "").normalize("NFC").trim();
  if (input.kind === "bleeding") {
    if (!input.bleeding)
      throw new AppError("INVALID_INPUT", "출혈 여부를 골라주세요.");
    return {
      kind: input.kind,
      started_at: new Date(start),
      ended_at: null,
      intensity: null,
      bleeding: input.bleeding,
      bleeding_color:
        input.bleeding === "none" ? null : (input.bleeding_color ?? null),
      memo,
    };
  }
  if (!input.ended_at)
    throw new AppError("INVALID_TIME", "종료 시각이 필요합니다.");
  const end = new Date(input.ended_at).getTime();
  if (end <= start)
    throw new AppError("INVALID_TIME", "종료는 시작보다 늦어야 합니다.");
  if (end - start > MAX_DURATION_MIN * 60000)
    throw new AppError(
      "INVALID_TIME",
      `한 번의 기록은 ${MAX_DURATION_MIN}분을 넘을 수 없습니다. 종료 시각을 확인해주세요.`,
    );
  if (end > Date.now() + 10 * 60000)
    throw new AppError("INVALID_TIME", "미래 시각으로는 기록할 수 없습니다.");
  return {
    kind: input.kind,
    started_at: new Date(start),
    ended_at: new Date(end),
    intensity: input.intensity ?? null,
    bleeding: null,
    bleeding_color: null,
    memo,
  };
}
async function insertPhotos(
  client: PoolClient,
  actor: Actor,
  eventId: string,
  photos: string[],
  firstPosition: number,
) {
  let position = firstPosition;
  for (const photo of photos) {
    if (photo.length % 4 !== 0)
      throw new AppError("INVALID_PHOTO", "올바른 사진 데이터가 필요합니다.");
    const content = await normalizePhoto(Buffer.from(photo, "base64"));
    await query(
      "INSERT INTO pregnancy_photos(household_id,event_id,position,content,content_hash) VALUES($1,$2,$3,$4,$5)",
      [
        actor.householdId,
        eventId,
        position++,
        content,
        createHash("sha256").update(content).digest("hex"),
      ],
      client,
    );
  }
}
async function lockEvent(
  client: PoolClient,
  actor: Actor,
  role: string,
  id: string,
  expectedVersion: number,
) {
  const [row] = await query(
    "SELECT id, kind, version, created_by FROM pregnancy_events WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  if (!canEdit(role, actor, row.created_by))
    throw new AppError(
      "FORBIDDEN",
      "기록한 사람 또는 관리자만 수정할 수 있습니다.",
      403,
    );
  if (row.version !== expectedVersion)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  return row;
}

export async function runPregnancyCommand(actor: Actor, raw: unknown) {
  const input = pregnancyCommand.parse(raw);
  return transaction(async (client) => {
    const role = await access(actor, client);
    if (input.action === "settings") {
      const [current] = await query(
        "SELECT version FROM pregnancy_settings WHERE household_id=$1 FOR UPDATE",
        [actor.householdId],
        client,
      );
      if ((current?.version ?? 0) !== input.expected_version)
        throw new AppError(
          "VERSION_CONFLICT",
          "다른 곳에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요.",
          409,
        );
      const [row] = await query(
        `INSERT INTO pregnancy_settings(household_id,due_date,updated_by) VALUES($1,$2,$3)
         ON CONFLICT(household_id) DO UPDATE SET due_date=excluded.due_date, updated_by=excluded.updated_by,
         version=pregnancy_settings.version+1, updated_at=now() RETURNING due_date, version`,
        [actor.householdId, input.due_date, actor.userId],
        client,
      );
      return { settings: { due_date: row.due_date, version: row.version } };
    }
    if (input.action === "create") {
      const v = normalize(input);
      const [created] = await query(
        `INSERT INTO pregnancy_events(household_id,kind,started_at,ended_at,intensity,bleeding,bleeding_color,memo,request_key,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         ON CONFLICT(household_id,request_key) DO NOTHING RETURNING id`,
        [
          actor.householdId,
          v.kind,
          v.started_at,
          v.ended_at,
          v.intensity,
          v.bleeding,
          v.bleeding_color,
          v.memo,
          input.request_key,
          actor.userId,
        ],
        client,
      );
      if (!created) {
        // 같은 기기가 저장을 다시 보낸 경우다. 이미 저장된 기록을 돌려준다.
        const [existing] = await query(
          "SELECT id FROM pregnancy_events WHERE household_id=$1 AND request_key=$2",
          [actor.householdId, input.request_key],
          client,
        );
        return { event: await eventById(actor, role, existing.id, client) };
      }
      if (input.photos?.length) {
        if (v.kind !== "bleeding")
          throw new AppError(
            "INVALID_INPUT",
            "사진은 출혈 기록에만 붙일 수 있습니다.",
          );
        await insertPhotos(client, actor, created.id, input.photos, 0);
      }
      return { event: await eventById(actor, role, created.id, client) };
    }
    const row = await lockEvent(
      client,
      actor,
      role,
      input.id,
      input.expected_version,
    );
    if (input.action === "delete") {
      await query(
        "DELETE FROM pregnancy_events WHERE household_id=$1 AND id=$2",
        [actor.householdId, input.id],
        client,
      );
      return { deleted: input.id };
    }
    const v = normalize(input);
    if ((row.kind === "bleeding") !== (v.kind === "bleeding"))
      throw new AppError(
        "INVALID_INPUT",
        "출혈 기록과 통증 기록은 서로 바꿀 수 없습니다.",
      );
    await query(
      `UPDATE pregnancy_events SET kind=$3, started_at=$4, ended_at=$5, intensity=$6, bleeding=$7, bleeding_color=$8,
       memo=$9, version=version+1, updated_by=$10, updated_at=now() WHERE household_id=$1 AND id=$2`,
      [
        actor.householdId,
        input.id,
        v.kind,
        v.started_at,
        v.ended_at,
        v.intensity,
        v.bleeding,
        v.bleeding_color,
        v.memo,
        actor.userId,
      ],
      client,
    );
    if (v.kind === "bleeding") {
      const keep = input.keep_photo_ids ?? [];
      await query(
        "DELETE FROM pregnancy_photos WHERE household_id=$1 AND event_id=$2 AND NOT (id = ANY($3::uuid[]))",
        [actor.householdId, input.id, keep],
        client,
      );
      // 남은 사진을 0부터 다시 번호 매기고 새 사진을 뒤에 붙인다.
      const kept = await query(
        `UPDATE pregnancy_photos p SET position=r.n FROM (
           SELECT id, (row_number() OVER (ORDER BY position, created_at) - 1)::int AS n
           FROM pregnancy_photos WHERE household_id=$1 AND event_id=$2) r
         WHERE p.id=r.id RETURNING p.id`,
        [actor.householdId, input.id],
        client,
      );
      const photos = input.photos ?? [];
      if (kept.length + photos.length > MAX_PHOTOS)
        throw new AppError(
          "INVALID_PHOTO",
          `사진은 최대 ${MAX_PHOTOS}장까지 붙일 수 있습니다.`,
        );
      await insertPhotos(client, actor, input.id, photos, kept.length);
    }
    return { event: await eventById(actor, role, input.id, client) };
  });
}

export async function readPregnancyPhoto(actor: Actor, id: string) {
  await access(actor);
  const [row] = await query(
    "SELECT content FROM pregnancy_photos WHERE household_id=$1 AND id=$2",
    [actor.householdId, id],
  );
  if (!row) throw new AppError("NOT_FOUND", "사진이 없습니다.", 404);
  return row.content as Buffer;
}
