import {
  webActor,
  sameOrigin,
  rateLimit,
  errorResponse,
} from "@/server/security";
import {
  readHtmlUpload,
  updateHtmlUpload,
  deleteHtmlUpload,
} from "@/server/html-uploads";
import { readJson } from "../body";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const noStore = { headers: { "Cache-Control": "private, no-store" } };
// 실행용 소스는 CSP를 넣은 뒤 JSON으로만 준다. text/html로 직접 열 수 있는 URL을 만들지 않는다.
export async function GET(request: Request, context: Context) {
  try {
    const actor = await webActor(request.headers);
    const { id } = await context.params;
    return Response.json(await readHtmlUpload(actor, id), noStore);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    await rateLimit(`html-upload:${actor.userId}`, 20);
    const { id } = await context.params;
    return Response.json(
      { page: await updateHtmlUpload(actor, id, await readJson(request)) },
      noStore,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    const { id } = await context.params;
    await deleteHtmlUpload(actor, id, await readJson(request));
    return Response.json({ ok: true }, noStore);
  } catch (e) {
    return errorResponse(e);
  }
}
