import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/lib/types";
import {
  HTML_UPLOAD_LIMIT,
  HTML_UPLOAD_MAX_BYTES,
  type HtmlUpload,
} from "@/lib/html-pages";
import { query, transaction } from "./db";
import { AppError } from "./security";
import { isolate } from "./html-pages";

// 기타 / HTML 도구 중 웹에서 올린 HTML. 구성원 누구나 열고, 올린 사람·관리자만 교체·삭제한다.
// 원본은 실행하지 않고 저장만 하며, 열 때 isolate()로 CSP를 넣어 sandbox iframe에 보낸다.
const COLUMNS =
  "id::text AS id,title,description,filename,octet_length(content)::int AS bytes,version,created_by,updated_at";
type Row = Omit<HtmlUpload, "canEdit"> & { created_by: string };

function webOnly(actor: Actor) {
  if (actor.channel !== "web")
    throw new AppError(
      "FORBIDDEN",
      "HTML 도구는 웹에서만 사용할 수 있습니다.",
      403,
    );
}
const canEdit = (actor: Actor, row: Row) =>
  actor.role === "owner" || row.created_by === actor.userId;
function view(actor: Actor, { created_by, ...row }: Row): HtmlUpload {
  return { ...row, canEdit: canEdit(actor, { ...row, created_by }) };
}

const text = (max: number) => z.string().trim().max(max);
const html = z
  .string()
  .min(1)
  .refine((s) => Buffer.byteLength(s) <= HTML_UPLOAD_MAX_BYTES, {
    message: "HTML은 3MB까지 올릴 수 있습니다.",
  })
  .refine((s) => /<(?:!doctype\s+html|html|head|body)[\s>]/i.test(s), {
    message: "HTML 문서가 아닙니다.",
  });
const createInput = z.object({
  title: text(80).min(1),
  description: text(200).default(""),
  filename: text(200).min(1),
  html,
});
const updateInput = z.object({
  title: text(80).min(1),
  description: text(200).default(""),
  filename: text(200).min(1).optional(),
  html: html.optional(),
  expected_version: z.number().int().positive(),
});
const versionInput = z.object({
  expected_version: z.number().int().positive(),
});
function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      "INVALID_INPUT",
      result.error.issues[0]?.message.startsWith("HTML")
        ? result.error.issues[0].message
        : "제목과 HTML 파일을 확인해주세요.",
    );
  return result.data;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function listHtmlUploads(actor: Actor) {
  webOnly(actor);
  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM html_uploads WHERE household_id=$1 ORDER BY updated_at DESC`,
    [actor.householdId],
  );
  return rows.map((r) => view(actor, r));
}

export async function readHtmlUpload(actor: Actor, id: string) {
  webOnly(actor);
  z.uuid().parse(id);
  const [row] = await query<Row & { content: string }>(
    `SELECT ${COLUMNS},content FROM html_uploads WHERE household_id=$1 AND id=$2`,
    [actor.householdId, id],
  );
  if (!row) throw new AppError("NOT_FOUND", "HTML을 찾을 수 없습니다.", 404);
  const { content, ...info } = row;
  return { page: view(actor, info), html: isolate(content) };
}

export async function createHtmlUpload(actor: Actor, input: unknown) {
  webOnly(actor);
  const data = parse(createInput, input);
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `html-uploads:${actor.householdId}`,
    ]);
    const [{ count }] = await query<{ count: number }>(
      "SELECT count(*)::int AS count FROM html_uploads WHERE household_id=$1",
      [actor.householdId],
      client,
    );
    if (count >= HTML_UPLOAD_LIMIT)
      throw new AppError(
        "LIMIT",
        `HTML은 공간당 ${HTML_UPLOAD_LIMIT}개까지 올릴 수 있습니다.`,
      );
    const [row] = await query<Row>(
      `INSERT INTO html_uploads(household_id,title,description,filename,content,content_hash,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING ${COLUMNS}`,
      [
        actor.householdId,
        data.title,
        data.description,
        data.filename,
        data.html,
        hash(data.html),
        actor.userId,
      ],
      client,
    );
    return view(actor, row);
  });
}

async function lockOwned(
  client: Parameters<Parameters<typeof transaction>[0]>[0],
  actor: Actor,
  id: string,
  expectedVersion: number,
) {
  z.uuid().parse(id);
  const [row] = await query<Row>(
    `SELECT ${COLUMNS} FROM html_uploads WHERE household_id=$1 AND id=$2 FOR UPDATE`,
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "HTML을 찾을 수 없습니다.", 404);
  if (!canEdit(actor, row))
    throw new AppError(
      "FORBIDDEN",
      "올린 사람 또는 관리자만 바꿀 수 있습니다.",
      403,
    );
  if (row.version !== expectedVersion)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 바뀌었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  return row;
}

export async function updateHtmlUpload(
  actor: Actor,
  id: string,
  input: unknown,
) {
  webOnly(actor);
  const data = parse(updateInput, input);
  return transaction(async (client) => {
    await lockOwned(client, actor, id, data.expected_version);
    const [row] = await query<Row>(
      `UPDATE html_uploads SET title=$3, description=$4,
         filename=COALESCE($5, filename), content=COALESCE($6, content), content_hash=COALESCE($7, content_hash),
         updated_by=$8, updated_at=now(), version=version+1
       WHERE household_id=$1 AND id=$2 RETURNING ${COLUMNS}`,
      [
        actor.householdId,
        id,
        data.title,
        data.description,
        data.html === undefined ? null : (data.filename ?? null),
        data.html ?? null,
        data.html === undefined ? null : hash(data.html),
        actor.userId,
      ],
      client,
    );
    return view(actor, row);
  });
}

export async function deleteHtmlUpload(
  actor: Actor,
  id: string,
  input: unknown,
) {
  webOnly(actor);
  const { expected_version } = parse(versionInput, input);
  await transaction(async (client) => {
    await lockOwned(client, actor, id, expected_version);
    await query(
      "DELETE FROM html_uploads WHERE household_id=$1 AND id=$2",
      [actor.householdId, id],
      client,
    );
  });
}
