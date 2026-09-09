import { webActor, errorResponse } from "@/server/security";
import { htmlPage } from "@/server/html-pages";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ page: string }> },
) {
  try {
    await webActor(request.headers);
    const { page } = await context.params;
    const html = await htmlPage(page);
    if (!html)
      return Response.json(
        { error: { message: "등록되지 않은 HTML 페이지입니다." } },
        { status: 404 },
      );
    return Response.json(
      { html },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
