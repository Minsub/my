import {
  webActor,
  errorResponse,
  rateLimit,
  AppError,
} from "@/server/security";
import { searchNaverStocks } from "@/server/naver-stock";
export const runtime = "nodejs";
// 분할매수 전략에 종목을 넣을 때 티커나 이름으로 정확한 종목명을 찾는다.
// 공간 데이터를 읽지 않지만 외부 호출이라 로그인과 요청 한도를 건다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`asset-stock-search:${actor.userId}`, 60);
    const q = (new URL(request.url).searchParams.get("q") ?? "")
      .trim()
      .slice(0, 100);
    if (!q)
      throw new AppError("INVALID_INPUT", "티커나 종목명을 입력해주세요.");
    let items;
    try {
      items = await searchNaverStocks(q);
    } catch (e) {
      throw new AppError(
        "UPSTREAM",
        (e as Error).message || "종목을 찾지 못했습니다.",
        502,
      );
    }
    return Response.json(
      { items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
