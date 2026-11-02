import { createHash } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import { normalizePhoto } from "./wine-photos";
import type { Actor } from "@/lib/types";
// 브랜드 대표 이미지는 웹에서만 올린다(MCP 도구 없음). 저장 규칙은 와인 사진과 같다.
// 다시 보낸 요청은 version 검사로 막는다. 사진 교체는 같은 사진으로 다시 해도 결과가 같아 요청 키를 따로 두지 않는다.
const brandPhotoSchema = z
  .object({
    brand_id: z.uuid(),
    expected_version: z.number().int().positive(),
    image_base64: z.string().min(4).max(2800000),
  })
  .strict();
export async function uploadBrandPhoto(actor: Actor, raw: unknown) {
  requireScope(actor, "coffee:write");
  if (actor.channel !== "web")
    throw new AppError(
      "FORBIDDEN",
      "브랜드 이미지는 웹 화면에서만 올릴 수 있습니다.",
      403,
    );
  const input = brandPhotoSchema.parse(raw);
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(input.image_base64) ||
    input.image_base64.length % 4 !== 0
  )
    throw new AppError("INVALID_PHOTO", "올바른 base64 사진이 필요합니다.");
  const content = await normalizePhoto(
    Buffer.from(input.image_base64, "base64"),
  );
  return transaction(async (client) => {
    const [member] = await query(
      "SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND active=true FOR SHARE",
      [actor.householdId, actor.userId],
      client,
    );
    if (!member)
      throw new AppError("FORBIDDEN", "가족 접근 권한이 없습니다.", 403);
    const [brand] = await query(
      "SELECT * FROM coffee_brands WHERE household_id=$1 AND id=$2 FOR UPDATE",
      [actor.householdId, input.brand_id],
      client,
    );
    if (!brand)
      throw new AppError("NOT_FOUND", "브랜드를 찾을 수 없습니다.", 404);
    if (member.role !== "owner" && brand.created_by !== actor.userId)
      throw new AppError(
        "FORBIDDEN",
        "등록자 또는 관리자만 이미지를 변경할 수 있습니다.",
        403,
      );
    if (brand.version !== input.expected_version)
      throw new AppError(
        "VERSION_CONFLICT",
        "다른 변경 사항이 있습니다. 새로고침 후 다시 시도해주세요.",
        409,
      );
    await query(
      "INSERT INTO coffee_brand_photos(brand_id,content,content_hash) VALUES($1,$2,$3) ON CONFLICT(brand_id) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,updated_at=now()",
      [brand.id, content, createHash("sha256").update(content).digest("hex")],
      client,
    );
    await query(
      "UPDATE coffee_brands SET version=version+1 WHERE id=$1",
      [brand.id],
      client,
    );
    return { id: brand.id, version: brand.version + 1, has_photo: true };
  });
}
