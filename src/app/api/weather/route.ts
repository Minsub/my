import { webActor, errorResponse, rateLimit } from "@/server/security";
import { todayWeather } from "@/server/weather";
export const runtime = "nodejs";
// 취미 / 시계의 날씨(오늘 시간별 기온·상태, 최저·최고). 로그인한 사용자만 부르며 값은 서버 메모리에 1시간 둔다.
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
