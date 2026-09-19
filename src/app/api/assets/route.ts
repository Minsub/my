import { webActor, errorResponse, rateLimit } from "@/server/security";
import {
  readAssetExport,
  readAssetHistory,
  readAssetItems,
  readAssetOverview,
} from "@/server/assets";
import { assetItemsCsv } from "@/lib/assets";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`asset-read:${actor.userId}`);
    const url = new URL(request.url);
    const q = url.searchParams;
    const view = q.get("view");
    if (view === "export") {
      const rows = await readAssetExport(actor);
      return new Response(assetItemsCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("자산기록.csv")}`,
        },
      });
    }
    const data =
      view === "items"
        ? await readAssetItems(actor, {
            owner: q.get("owner") ?? undefined,
            period: q.get("period") ?? undefined,
            axis: q.get("axis") ?? undefined,
            at: q.get("at") ?? undefined,
            bucket: q.get("bucket") ?? undefined,
          })
        : view === "history"
          ? await readAssetHistory(actor, {
              snapshot: q.get("snapshot") ?? undefined,
            })
          : await readAssetOverview(actor, {
              owner: q.get("owner") ?? undefined,
              period: q.get("period") ?? undefined,
              range: q.get("range") ?? undefined,
              from: q.get("from") ?? undefined,
              to: q.get("to") ?? undefined,
            });
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
