import { webActor, errorResponse } from "@/server/security";
import { listWineShares } from "@/server/wine-shares";
export const runtime = "nodejs";
// 셀러의 "공유한 목록" 화면. 만들기·끄기는 POST /api/commands(wine_share_create·wine_share_revoke)다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    return Response.json(
      { data: await listWineShares(actor) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
