import { webActor, rateLimit } from "@/server/security";
import { naverStockUrl } from "@/server/naver-stock";
import { naverStockSearchUrl } from "@/lib/assets";
export const runtime = "nodejs";
// 종목 이름을 받아 네이버 증권 종목 페이지로 보낸다. 화면은 이 주소를 새 창으로 연다.
// 공간의 데이터를 읽지 않으므로 로그인이 없거나 요청이 많으면 조회 없이 검색으로 보낸다.
// 보내는 곳은 stock.naver.com·search.naver.com 두 곳뿐이라 임의 주소로 넘기지 않는다.
export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") ?? "")
    .trim()
    .slice(0, 200);
  const go = (location: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: location, "Cache-Control": "private, no-store" },
    });
  if (!name) return go("https://stock.naver.com/");
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`asset-stock-link:${actor.userId}`, 60);
  } catch {
    return go(naverStockSearchUrl(name));
  }
  return go(await naverStockUrl(name));
}
