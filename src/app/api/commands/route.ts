import { z } from "zod";
import {
  webActor,
  errorResponse,
  sameOrigin,
  rateLimit,
  AppError,
} from "@/server/security";
import { execute } from "@/server/service";
import { commandSchemas, type Operation } from "@/lib/contracts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    await rateLimit(`write:${actor.userId}`, 60);
    const text = await request.text();
    if (text.length > 32768)
      throw new AppError("TOO_LARGE", "입력이 너무 큽니다.", 413);
    const body = z
      .object({
        operation: z.string().refine((v) => Object.hasOwn(commandSchemas, v)),
        input: z.unknown(),
      })
      .strict()
      .parse(JSON.parse(text));
    return Response.json(
      { data: await execute(actor, body.operation as Operation, body.input) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
