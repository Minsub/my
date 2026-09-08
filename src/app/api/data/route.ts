import { webActor, errorResponse, rateLimit } from "@/server/security";
import { snapshot } from "@/server/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`read:${actor.userId}`);
    return Response.json(await snapshot(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
