import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
async function main() {
  if (process.env.MIGRATION_DATABASE_URL)
    process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  const { authOptions } = await import("../src/server/auth");
  const { getPool } = await import("../src/server/db");
  const { getMigrations } = await import("better-auth/db/migration");
  const plan = await getMigrations(authOptions());
  await plan.runMigrations();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('daily-migrations'))",
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir("db/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`db/migrations/${name}`, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        "SELECT checksum FROM app_migrations WHERE name=$1",
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== hash)
          throw Error(`Changed applied migration: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        "INSERT INTO app_migrations(name,checksum) VALUES($1,$2)",
        [name, hash],
      );
      console.log(`Applied ${name}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await getPool().end();
  }
  console.log("Migrations complete");
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Migration failed");
  process.exit(1);
});
