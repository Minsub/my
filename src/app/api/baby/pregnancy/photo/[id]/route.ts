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
        // 사진은 id마다 내용이 바뀌지 않는다(수정하면 새 id). 같은 기기에서 다시 볼 때 DB를 읽지 않는다.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
