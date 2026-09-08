import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { seedBrands, seedBeans } from "../src/lib/seed-data";
import { query, transaction, getPool } from "../src/server/db";
export async function seed(householdId?: string, userId?: string) {
  const [owner] = await query(
    "SELECT * FROM household_members WHERE role=$1 AND active=true ORDER BY household_id LIMIT 1",
    ["owner"],
  );
  const hid = householdId ?? owner?.household_id,
    uid = userId ?? owner?.user_id;
  if (!hid || !uid) throw Error("먼저 OWNER_EMAIL 계정으로 로그인해주세요.");
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('daily-seed'))");
    const brands = new Map<string, string>();
    for (const b of seedBrands) {
      let [row] = await query(
        "SELECT id FROM coffee_brands WHERE household_id=$1 AND name=$2",
        [hid, b.name],
        c,
      );
      if (!row)
        [row] = await query(
          "INSERT INTO coffee_brands(household_id,name,url,created_by) VALUES($1,$2,$3,$4) RETURNING id",
          [hid, b.name, b.url, uid],
          c,
        );
      brands.set(b.name, row.id);
    }
    let [machine] = await query(
      "SELECT id FROM coffee_machines WHERE household_id=$1 ORDER BY name LIMIT 1",
      [hid],
      c,
    );
    if (!machine)
      [machine] = await query(
        "INSERT INTO coffee_machines(household_id,name) VALUES($1,$2) RETURNING id",
        [hid, "기존 머신 · 기기 설정값"],
        c,
      );
    for (const b of seedBeans) {
      if (
        (
          await query(
            "SELECT id FROM coffee_beans WHERE household_id=$1 AND product_url=$2",
            [hid, b.url],
            c,
          )
        ).length
      )
        continue;
      const [row] = await query(
        "INSERT INTO coffee_beans(household_id,brand_id,name,product_url,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [hid, brands.get(b.brand), b.name, b.url, uid],
        c,
      );
      if (b.recommendation)
        await query(
          "INSERT INTO coffee_preferences(household_id,bean_id,user_id,recommendation,note) VALUES($1,$2,$3,$4,$5)",
          [hid, row.id, uid, b.recommendation, b.note],
          c,
        );
      if (b.grind !== null)
        await query(
          "INSERT INTO coffee_brew_settings(household_id,bean_id,user_id,machine_id,grind,dose,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            hid,
            row.id,
            uid,
            machine.id,
            b.grind,
            b.dose!,
            "기존 문서의 머신 설정값",
          ],
          c,
        );
    }
  });
}
if (process.argv[1]?.endsWith("seed.ts"))
  seed()
    .then(() =>
      console.log("Coffee seed complete (existing records preserved)"),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => getPool().end());
