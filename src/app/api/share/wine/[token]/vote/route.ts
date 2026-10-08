import {
  errorResponse,
  sameOrigin,
  rateLimit,
  AppError,
} from "@/server/security";
import { submitShareVote } from "@/server/wine-shares";
export const runtime = "nodejs";
// 로그인 없이 받는 유일한 쓰기. 같은 출처·IP 빈도·크기를 제한하고 공유 행 기준으로만 저장한다.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    sameOrigin(request);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    await rateLimit(`share-vote:${ip}`, 20);
    const text = await request.text();
    if (text.length > 4096)
      throw new AppError("TOO_LARGE", "입력이 너무 큽니다.", 413);
    const { token } = await ctx.params;
    return Response.json(
      { data: await submitShareVote(token, JSON.parse(text)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
