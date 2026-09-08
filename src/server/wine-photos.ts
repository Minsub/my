import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import type { Actor } from "@/lib/types";
export const photoSchema = z
  .object({
    wine_id: z.uuid(),
    expected_version: z.number().int().positive(),
    idempotency_key: z.uuid(),
    image_base64: z.string().min(4).max(2800000),
  })
  .strict();
export async function normalizePhoto(bytes: Buffer) {
  if (bytes.length > 2100000)
    throw new AppError("TOO_LARGE", "사진은 2MB 이하로 올려주세요.", 413);
  try {
    const metadata = await sharp(bytes, {
      limitInputPixels: 24000000,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages ?? 1) > 1
    )
      throw Error();
    const content = await sharp(bytes, { limitInputPixels: 24000000 })
      .rotate()
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    if (content.length > 300000)
      throw new AppError("TOO_LARGE", "더 작은 사진을 선택해주세요.", 413);
    return content;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "INVALID_PHOTO",
      "JPEG, PNG, WebP 사진 파일을 선택해주세요.",
    );
  }
}
export async function uploadWinePhoto(actor: Actor, raw: unknown) {
  requireScope(actor, "wine:write");
  const input = photoSchema.parse(raw);
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(input.image_base64) ||
    input.image_base64.length % 4 !== 0
  )
    throw new AppError("INVALID_PHOTO", "올바른 base64 사진이 필요합니다.");
  const bytes = Buffer.from(input.image_base64, "base64");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const content = await normalizePhoto(bytes);
  return transaction(async (client) => {
    const [member] = await query(
      "SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND active=true FOR SHARE",
      [actor.householdId, actor.userId],
      client,
    );
    if (!member)
      throw new AppError("FORBIDDEN", "가족 접근 권한이 없습니다.", 403);
    await query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [actor.householdId + actor.userId + input.idempotency_key],
      client,
    );
    const [prior] = await query(
      "SELECT * FROM wine_photo_requests WHERE household_id=$1 AND user_id=$2 AND request_key=$3",
      [actor.householdId, actor.userId, input.idempotency_key],
      client,
    );
    if (prior) {
      if (prior.input_hash !== hash)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "같은 키의 입력이 다릅니다.",
          409,
        );
      return prior.result;
    }
    const [wine] = await query(
      "SELECT * FROM wines WHERE household_id=$1 AND id=$2 FOR UPDATE",
      [actor.householdId, input.wine_id],
      client,
    );
    if (!wine) throw new AppError("NOT_FOUND", "와인을 찾을 수 없습니다.", 404);
    if (member.role !== "owner" && wine.created_by !== actor.userId)
      throw new AppError(
        "FORBIDDEN",
        "등록자 또는 관리자만 사진을 변경할 수 있습니다.",
        403,
      );
    if (wine.version !== input.expected_version)
      throw new AppError(
        "VERSION_CONFLICT",
        "다른 변경 사항이 있습니다. 새로고침 후 다시 시도해주세요.",
        409,
      );
    await query(
      "INSERT INTO wine_photos(wine_id,content,content_hash) VALUES($1,$2,$3) ON CONFLICT(wine_id) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,updated_at=now()",
      [wine.id, content, createHash("sha256").update(content).digest("hex")],
      client,
    );
    await query(
      "UPDATE wines SET version=version+1 WHERE id=$1",
      [wine.id],
      client,
    );
    const result = { id: wine.id, version: wine.version + 1, has_photo: true };
    await query(
      "INSERT INTO wine_photo_requests(household_id,user_id,request_key,input_hash,result) VALUES($1,$2,$3,$4,$5)",
      [
        actor.householdId,
        actor.userId,
        input.idempotency_key,
        hash,
        JSON.stringify(result),
      ],
      client,
    );
    return result;
  });
}
