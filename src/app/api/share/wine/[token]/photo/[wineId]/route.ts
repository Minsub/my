import { errorResponse, AppError } from "@/server/security";
import { publicSharePhoto } from "@/server/wine-shares";
export const runtime = "nodejs";
// 로그인 없이 여는 공유 페이지의 사진. 유효한 공유에 들어 있는 와인만 돌려준다.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string; wineId: string }> },
) {
  try {
    const { token, wineId } = await ctx.params;
    const content = await publicSharePhoto(token, wineId);
    if (!content) throw new AppError("NOT_FOUND", "사진이 없습니다.", 404);
    // 공유를 끄면 바로 막히도록 공용 캐시(CDN)에는 두지 않는다.
    const versioned = new URL(request.url).searchParams.has("v");
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": versioned
          ? "private, max-age=3600"
          : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
