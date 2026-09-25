import { z } from "zod";
import { webActor, rateLimit, errorResponse } from "@/server/security";
import { readPregnancyPhoto } from "@/server/pregnancy";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`pregnancy-photo:${actor.userId}`, 240);
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const content = await readPregnancyPhoto(actor, id);
    return new Response(new Uint8Array(content), {
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
