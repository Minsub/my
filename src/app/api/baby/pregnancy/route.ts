import {
  webActor,
  sameOrigin,
  rateLimit,
  errorResponse,
  AppError,
} from "@/server/security";
import { readPregnancy, runPregnancyCommand } from "@/server/pregnancy";
export const runtime = "nodejs";
export const maxDuration = 30;
// 출혈 사진 4장을 브라우저에서 줄여 보내도 여유가 있는 크기. Vercel 요청 한도(4.5MB)보다 작다.
const MAX_BODY = 4000000;
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`pregnancy-read:${actor.userId}`);
    return Response.json(await readPregnancy(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    await rateLimit(`pregnancy-write:${actor.userId}`, 60);
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError(
        "TOO_LARGE",
        "사진 용량이 큽니다. 장수를 줄여주세요.",
        413,
      );
    return Response.json(await runPregnancyCommand(actor, JSON.parse(text)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
