import {
  webActor,
  sameOrigin,
  rateLimit,
  errorResponse,
  AppError,
} from "@/server/security";
import { cashFiles, saveCashFile, downloadCash } from "@/server/cash";
import { CASH_MAX_BYTES } from "@/server/cash-parser";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const file = await downloadCash(actor, id);
      return new Response(new Uint8Array(file.content), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return Response.json(
      { files: await cashFiles(actor) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(request.headers);
    await rateLimit(`cash-upload:${actor.userId}`, 12);
    const params = new URL(request.url).searchParams;
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("INVALID_WORKBOOK", "파일을 선택해주세요.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > CASH_MAX_BYTES) {
        await reader.cancel();
        throw new AppError(
          "TOO_LARGE",
          "파일당 최대 3MB까지 업로드할 수 있습니다.",
          413,
        );
      }
      chunks.push(value);
    }
    const expected = z.coerce
      .number()
      .int()
      .min(0)
      .parse(params.get("version") || 0);
    const result = await saveCashFile(
      actor,
      params.get("filename") || "",
      Buffer.concat(chunks),
      expected,
      params.get("preview") === "true",
    );
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
