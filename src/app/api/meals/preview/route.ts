import {
  webActor,
  errorResponse,
  rateLimit,
  AppError,
} from "@/server/security";
import { linkPreview } from "@/server/link-preview";
export const runtime = "nodejs";
// 집밥 링크 카드의 제목·썸네일. 결과는 저장하지 않고 브라우저가 하루 캐시한다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`meal-preview:${actor.userId}`, 90);
    const url = new URL(request.url).searchParams.get("url") ?? "";
    if (!url || url.length > 2000)
      throw new AppError("INVALID_INPUT", "링크 주소를 확인해주세요.");
    return Response.json(await linkPreview(url), {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
