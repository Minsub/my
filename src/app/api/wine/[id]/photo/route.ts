import { z } from "zod";
import {
  webActor,
  mcpActor,
  sameOrigin,
  requireScope,
  rateLimit,
  errorResponse,
  AppError,
} from "@/server/security";
import { query } from "@/server/db";
import { uploadWinePhoto } from "@/server/wine-photos";
export const runtime = "nodejs";
async function actor(request: Request, write = false) {
  if (request.headers.has("authorization")) return mcpActor(request);
  if (write) sameOrigin(request);
  return webActor(request.headers);
}
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const a = await actor(request);
    requireScope(a, "wine:read");
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const [row] = await query(
      "SELECT p.content FROM wine_photos p JOIN wines w ON w.id=p.wine_id WHERE w.id=$1 AND w.household_id=$2",
      [id, a.householdId],
    );
    if (!row) throw new AppError("NOT_FOUND", "사진이 없습니다.", 404);
    return new Response(new Uint8Array(row.content), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
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
    const a = await actor(request, true);
    requireScope(a, "wine:write");
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
      { data: await uploadWinePhoto(a, { ...body, wine_id: id }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
