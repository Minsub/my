import { webActor, errorResponse, rateLimit } from "@/server/security";
import { listMeals } from "@/server/meals";
export const runtime = "nodejs";
// 취미 / 집밥 목록. 쓰기는 공통 POST /api/commands(meal_*)를 쓴다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`meal-read:${actor.userId}`);
    return Response.json(
      { dishes: await listMeals(actor) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
