import { webActor, errorResponse, rateLimit } from "@/server/security";
import { todayWeather } from "@/server/weather";
export const runtime = "nodejs";
// 취미 / 시계의 오늘 날씨. 로그인한 사용자만 부르며 값은 서버 메모리에 30분 둔다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`weather-read:${actor.userId}`, 30);
    return Response.json(await todayWeather(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
