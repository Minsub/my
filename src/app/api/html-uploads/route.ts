import {
  webActor,
  sameOrigin,
  rateLimit,
  errorResponse,
} from "@/server/security";
import { listHtmlUploads, createHtmlUpload } from "@/server/html-uploads";
import { readJson } from "./body";
export const runtime = "nodejs";
const noStore = { headers: { "Cache-Control": "private, no-store" } };
// 기타 / HTML 도구: 웹에서 올린 HTML 목록과 새로 올리기. 원본 소스는 [id]에서만 내려준다.
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    return Response.json({ pages: await listHtmlUploads(actor) }, noStore);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    await rateLimit(`html-upload:${actor.userId}`, 20);
    return Response.json(
      { page: await createHtmlUpload(actor, await readJson(request)) },
      noStore,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
