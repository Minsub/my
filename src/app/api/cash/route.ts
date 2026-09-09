import {
  webActor,
  rateLimit,
  errorResponse,
  AppError,
} from "@/server/security";
import { readCash } from "@/server/cash";
import type { CashRow } from "@/lib/cash";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const actor = await webActor(request.headers);
    await rateLimit(`cash-read:${actor.userId}`, 120);
    const p = new URL(request.url).searchParams;
    const result = await readCash(actor, p);
    if (p.get("mode") === "transactions" && p.get("export") === "csv") {
      const cell = (v: string | number) =>
        `"${String(v)
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replace(/"/g, '""')}"`;
      const rows = (result as { rows: CashRow[] }).rows;
      const csv = [
        [
          "날짜",
          "파일 소유자",
          "종류",
          "분류",
          "소분류",
          "내용",
          "결제수단",
          "원화 금액",
          "원본 통화",
          "원본 금액",
        ],
        ...rows.map((r) => [
          r.date,
          r.member,
          r.type,
          r.category,
          r.subCategory,
          r.memo,
          r.asset,
          r.amount,
          r.currency,
          r.originalAmount ?? "",
        ]),
      ]
        .map((row) => row.map(cell).join(","))
        .join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="mono-cash-transactions.csv"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (Buffer.byteLength(JSON.stringify(result)) > 3800000)
      throw new AppError(
        "LIMIT",
        "조회 결과가 큽니다. 기간이나 분류를 좁혀주세요.",
      );
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
