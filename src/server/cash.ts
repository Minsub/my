import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/lib/types";
import {
  aggregateCash,
  filteredCash,
  categoryName,
  type CashFile,
  type CashRow,
  type CashFilter,
} from "@/lib/cash";
import { query, transaction } from "./db";
import { AppError } from "./security";
import { cashFilename, parseCashWorkbook } from "./cash-parser";
function webOnly(actor: Actor) {
  if (actor.channel !== "web")
    throw new AppError(
      "FORBIDDEN",
      "가계부는 웹에서만 사용할 수 있습니다.",
      403,
    );
}
async function access(actor: Actor) {
  webOnly(actor);
  const [row] = await query(
    "SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND active=true",
    [actor.householdId, actor.userId],
  );
  if (!row) throw new AppError("FORBIDDEN", "접근 권한이 없습니다.", 403);
  return row.role;
}
const cache = new Map<string, { rows: CashRow[]; expires: number }>();
function parsed(id: string, hash: string, content: Buffer, filename: string) {
  const key = `${id}:${hash}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.rows;
  const result = parseCashWorkbook(content, filename).rows;
  while (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, { rows: result, expires: Date.now() + 5 * 60000 });
  return result;
}
const columns =
  "id,filename,content_hash,version,metadata,updated_at,created_by,octet_length(content) AS bytes";
export async function cashFiles(actor: Actor): Promise<CashFile[]> {
  const role = await access(actor);
  const rows = await query(
    `SELECT ${columns} FROM cash_files WHERE household_id=$1 ORDER BY filename`,
    [actor.householdId],
  );
  return rows.map((r) => ({
    ...r,
    canEdit: role === "owner" || r.created_by === actor.userId,
  })) as CashFile[];
}
export async function saveCashFile(
  actor: Actor,
  filename: string,
  content: Buffer,
  expectedVersion: number,
  preview = false,
) {
  const role = await access(actor);
  let normalized, parsedFile;
  try {
    normalized = cashFilename(filename);
    parsedFile = parseCashWorkbook(content, normalized.name);
  } catch (e) {
    throw new AppError("INVALID_WORKBOOK", (e as Error).message);
  }
  const hash = createHash("sha256").update(content).digest("hex");
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `cash:${actor.householdId}`,
    ]);
    const [existing] = await query(
      `SELECT ${columns} FROM cash_files WHERE household_id=$1 AND filename_key=$2 FOR UPDATE`,
      [actor.householdId, normalized.key],
      client,
    );
    if (existing && role !== "owner" && existing.created_by !== actor.userId)
      throw new AppError(
        "FORBIDDEN",
        "기존 파일은 업로드한 사람 또는 관리자가 교체할 수 있습니다.",
        403,
      );
    if (
      !preview &&
      existing?.content_hash !== hash &&
      (existing?.version ?? 0) !== expectedVersion
    )
      throw new AppError(
        "CONFLICT",
        "다른 업로드가 먼저 반영되었습니다. 다시 파일을 선택해 확인해주세요.",
        409,
      );
    const summary = {
      filename: normalized.name,
      metadata: parsedFile.metadata,
      bytes: content.length,
      previous: existing
        ? { version: existing.version, metadata: existing.metadata }
        : null,
      expectedVersion: existing?.version ?? 0,
      unchanged: existing?.content_hash === hash,
    };
    if (preview) return summary;
    const [{ count }] = await query(
      "SELECT count(*)::int AS count FROM cash_files WHERE household_id=$1",
      [actor.householdId],
      client,
    );
    if (!existing && count >= 20)
      throw new AppError(
        "LIMIT",
        "공간당 최대 20개 파일을 등록할 수 있습니다.",
      );
    if (existing?.content_hash === hash) return summary;
    await query(
      `INSERT INTO cash_files(household_id,filename,filename_key,content,content_hash,metadata,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(household_id,filename_key) DO UPDATE SET filename=excluded.filename,content=excluded.content,content_hash=excluded.content_hash,metadata=excluded.metadata,updated_by=excluded.updated_by,updated_at=now(),version=cash_files.version+1`,
      [
        actor.householdId,
        normalized.name,
        normalized.key,
        content,
        hash,
        JSON.stringify(parsedFile.metadata),
        actor.userId,
      ],
      client,
    );
    return summary;
  });
}
export async function downloadCash(actor: Actor, id: string) {
  await access(actor);
  z.uuid().parse(id);
  const [file] = await query(
    "SELECT filename,content FROM cash_files WHERE household_id=$1 AND id=$2",
    [actor.householdId, id],
  );
  if (!file) throw new AppError("NOT_FOUND", "파일이 없습니다.", 404);
  return file;
}
export async function readCash(actor: Actor, params: URLSearchParams) {
  const role = await access(actor);
  const records = await query(
    `SELECT ${columns},content FROM cash_files WHERE household_id=$1 ORDER BY filename`,
    [actor.householdId],
  );
  if (records.reduce((n, r) => n + Number(r.metadata.rows), 0) > 200000)
    throw new AppError("LIMIT", "분석 가능한 총 거래는 200,000행까지입니다.");
  const files = records.map((r) => ({
    id: r.id,
    filename: r.filename,
    content_hash: r.content_hash,
    version: r.version,
    metadata: r.metadata,
    updated_at: r.updated_at,
    bytes: r.bytes,
    canEdit: role === "owner" || r.created_by === actor.userId,
  })) as CashFile[];
  const all = records.flatMap((r) =>
    parsed(
      `${actor.householdId}:${r.id}`,
      r.content_hash,
      r.content,
      r.filename,
    ).map((x) => ({ ...x, id: `${r.id}:${x.id}` })),
  );
  const months = all.map((r) => r.date.slice(0, 7)).sort(),
    last = months.at(-1) || new Date().toISOString().slice(0, 7);
  const first = months[0] || last;
  const month = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
  const filter: CashFilter = {
    from: month.parse(
      params.get("from") || (last < "2021-01" ? first : "2021-01"),
    ),
    to: month.parse(params.get("to") || last),
    member: (params.get("member") || "").slice(0, 110),
    q: (params.get("q") || "").slice(0, 200),
    excludeLarge: params.get("large") === "true",
    expandOther: params.get("other") === "true",
    includeIncome: params.getAll("income").slice(0, 100),
    excludeExpense: params.getAll("expense").slice(0, 100),
    asset: (params.get("asset") || "").slice(0, 200),
  };
  if (
    filter.from > filter.to ||
    Number(filter.to.slice(0, 4)) - Number(filter.from.slice(0, 4)) > 100
  )
    throw new AppError(
      "INVALID_RANGE",
      "시작과 종료 기간을 확인해주세요. 최대 100년을 조회할 수 있습니다.",
    );
  if (params.get("mode") === "transactions") {
    let rows = filteredCash(all, filter);
    const category = params.get("category"),
      type = params.get("type"),
      sub = params.get("sub");
    if (type) rows = rows.filter((r) => r.type === type);
    if (category)
      rows = rows.filter(
        (r) => categoryName(r, filter.expandOther) === category,
      );
    if (sub !== null)
      rows = rows.filter((r) => (r.subCategory || "미분류") === sub);
    const sort = params.get("sort");
    rows.sort((a, b) =>
      sort === "amount-asc"
        ? a.amount - b.amount
        : sort === "amount-desc"
          ? b.amount - a.amount
          : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get("page") || 1);
    if (params.get("export") === "csv") {
      if (rows.length > 50000)
        throw new AppError(
          "LIMIT",
          "내보내기는 50,000건까지 가능합니다. 기간을 좁혀주세요.",
        );
      return { rows, count: rows.length };
    }
    return {
      rows: rows.slice((page - 1) * 50, page * 50),
      count: rows.length,
      income: rows
        .filter((r) => r.type === "수입")
        .reduce((n, r) => n + r.amount, 0),
      expense: rows
        .filter((r) => r.type === "지출")
        .reduce((n, r) => n + r.amount, 0),
    };
  }
  return aggregateCash(
    all,
    files,
    filter,
    params.get("granularity") === "month" ? "month" : "year",
  );
}
