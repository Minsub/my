import { webActor, errorResponse, rateLimit } from "@/server/security";
import { listFridge } from "@/server/fridge";
export const runtime = "nodejs";
// 취미 / 냉장고 목록. 쓰기는 공통 POST /api/commands(fridge_*)를 쓴다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`fridge-read:${actor.userId}`);
    return Response.json(await listFridge(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
