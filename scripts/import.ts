import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { query, transaction, getPool } from "../src/server/db";
const mapping: Record<string, string> = {
  "한글 이름": "fldaoCORde1HgHRok",
  "영어 이름": "fldXCZpzp2O8LXsoS",
  종류: "fld6m7oC81YO6GdTj",
  나라: "fld8oBT8wEfx3YlGJ",
  지역: "fldhcDBxjCvKg2QsC",
  품종: "fldjNDuzP5cgkzPoK",
  빈티지: "fldjwUPrIPf6xh1ZG",
  수량: "fldyNUSLA0nT6dlsY",
  점수: "fld7e7VVcoVqfGNix",
  "시음 노트": "fld9pRh46AZMvU7mc",
  "재구매 의사": "fld8ubX9hq3YibAet",
  "잔 이름": "fld8oBteROD0KFXyt",
  브랜드: "fldg7f56JDNetmeVw",
  "잔 종류": "fldhYyqjxobkbO6g7",
  메모: "fldfn8FOoyhlmHCfR",
};
export function parseAirtable(raw: unknown, kind: "wines" | "glasses") {
  const records = z
    .object({
      records: z.array(
        z.object({
          id: z.string().min(1),
          fields: z.record(z.string(), z.unknown()),
        }),
      ),
    })
    .parse(raw).records;
  const seen = new Set<string>();
  return records.map((r) => {
    if (seen.has(r.id)) throw Error("Duplicate source record ID");
    seen.add(r.id);
    const f = (name: string) => r.fields[name] ?? r.fields[mapping[name]];
    const str = (name: string) =>
      f(name) == null
        ? ""
        : Array.isArray(f(name))
          ? (f(name) as unknown[]).join(", ")
          : String(f(name));
    if (kind === "glasses")
      return {
        sourceId: r.id,
        raw: r.fields,
        kind,
        name: z.string().min(1).max(200).parse(str("잔 이름")),
        brand: str("브랜드"),
        type: str("잔 종류") || "유니버설",
        note: str("메모"),
      };
    const vintage =
      f("빈티지") == null
        ? null
        : z.number().int().min(1800).max(2200).parse(f("빈티지"));
    const score =
      f("점수") == null
        ? null
        : z.number().int().min(0).max(100).parse(f("점수"));
    return {
      sourceId: r.id,
      raw: r.fields,
      kind,
      name: z.string().min(1).max(200).parse(str("한글 이름")),
      english_name: str("영어 이름"),
      type: z
        .enum(["레드", "화이트", "로제", "스파클링", "디저트", "주정강화"])
        .parse(str("종류")),
      country: str("나라"),
      region: str("지역"),
      grapes: str("품종"),
      vintage,
      quantity: z
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(f("수량") ?? 0),
      score,
      note: str("시음 노트"),
      repurchase:
        typeof f("재구매 의사") === "boolean"
          ? (f("재구매 의사") as boolean)
          : null,
    };
  });
}
async function main() {
  const path = process.argv[2];
  if (!path || path.startsWith("--"))
    throw Error(
      "Usage: npm run db:import -- /path/export.json --kind=wines|glasses [--apply]",
    );
  const kind = process.argv.includes("--kind=glasses") ? "glasses" : "wines";
  const records = parseAirtable(JSON.parse(await readFile(path, "utf8")), kind);
  if (!process.argv.includes("--apply")) {
    console.log(
      `Validated ${records.length} ${kind}. No changes. Add --apply to import.`,
    );
    return;
  }
  const [owner] = await query(
    'SELECT m.* FROM household_members m JOIN "user" u ON u.id=m.user_id WHERE lower(u.email)=$1 AND m.role=$2 AND m.active=true',
    [process.env.OWNER_EMAIL?.toLowerCase(), "owner"],
  );
  if (!owner) throw Error("Owner account not found");
  let imported = 0;
  await transaction(async (c) => {
    await c.query(
      "SELECT pg_advisory_xact_lock(hashtext('daily-airtable-import'))",
    );
    for (const r of records) {
      const source = `airtable:${kind}`;
      if (
        (
          await query(
            "SELECT 1 FROM import_records WHERE household_id=$1 AND source=$2 AND source_id=$3",
            [owner.household_id, source, r.sourceId],
            c,
          )
        ).length
      )
        continue;
      let target: string;
      if (r.kind === "glasses") {
        const [row] = await query(
          "INSERT INTO wine_glasses(household_id,name,brand,type,note,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          [owner.household_id, r.name, r.brand, r.type, r.note, owner.user_id],
          c,
        );
        target = row.id;
      } else {
        const [row] = await query(
          "INSERT INTO wines(household_id,name,english_name,type,country,region,grapes,vintage_kind,vintage,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
          [
            owner.household_id,
            r.name,
            r.english_name,
            r.type,
            r.country,
            r.region,
            r.grapes,
            r.vintage ? "year" : "unknown",
            r.vintage,
            owner.user_id,
          ],
          c,
        );
        target = row.id;
        if (r.quantity)
          await query(
            "INSERT INTO wine_stock_events(household_id,wine_id,kind,delta,created_by,reason) VALUES($1,$2,'opening_balance',$3,$4,$5)",
            [
              owner.household_id,
              target,
              r.quantity,
              owner.user_id,
              `Airtable 이관: ${r.sourceId}`,
            ],
            c,
          );
        if (r.note || r.score !== null || r.repurchase !== null)
          await query(
            "INSERT INTO wine_tastings(household_id,wine_id,user_id,tasted_on,score,note,repurchase) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              owner.household_id,
              target,
              owner.user_id,
              null,
              r.score,
              `[이관 원문 · 실제 시음일 미상]\n${r.note}`,
              r.repurchase,
            ],
            c,
          );
      }
      await query(
        "INSERT INTO import_records(household_id,source,source_id,target_id,raw) VALUES($1,$2,$3,$4,$5)",
        [owner.household_id, source, r.sourceId, target, JSON.stringify(r.raw)],
        c,
      );
      imported++;
    }
  });
  console.log(
    `Imported ${imported}; skipped ${records.length - imported} existing source records. Original purchase metadata retained in import_records.`,
  );
  await getPool().end();
}
if (process.argv[1]?.endsWith("/import.ts"))
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
