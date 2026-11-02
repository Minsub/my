import { z } from "zod";
import {
  webActor,
  sameOrigin,
  requireScope,
  rateLimit,
  errorResponse,
  AppError,
} from "@/server/security";
import { query } from "@/server/db";
import { uploadBrandPhoto } from "@/server/coffee-brand-photos";
export const runtime = "nodejs";
// 브랜드 이미지는 웹 화면 전용이다. MCP 토큰(authorization 헤더)은 받지 않는다.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const a = await webActor(request.headers);
    requireScope(a, "coffee:read");
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const [row] = await query(
      "SELECT p.content FROM coffee_brand_photos p JOIN coffee_brands b ON b.id=p.brand_id WHERE b.id=$1 AND b.household_id=$2",
      [id, a.householdId],
    );
    if (!row) throw new AppError("NOT_FOUND", "이미지가 없습니다.", 404);
    // 화면은 ?v=브랜드 version으로 요청하고 이미지를 바꾸면 version이 오른다.
    const versioned = new URL(request.url).searchParams.has("v");
    return new Response(new Uint8Array(row.content), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": versioned
          ? "private, max-age=31536000, immutable"
          : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const a = await webActor(request.headers);
    await rateLimit("photo:" + a.userId, 12);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("INVALID_PHOTO", "사진이 필요합니다.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2801000) {
        await reader.cancel();
        throw new AppError("TOO_LARGE", "사진이 너무 큽니다.", 413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { id } = await ctx.params;
    return Response.json(
      { data: await uploadBrandPhoto(a, { ...body, brand_id: id }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
