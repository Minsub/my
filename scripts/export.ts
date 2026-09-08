import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { query, getPool } from "../src/server/db";
import { actorForUser } from "../src/server/security";
import { snapshot } from "../src/server/service";
async function main() {
  const [user] = await query('SELECT id FROM "user" WHERE lower(email)=$1', [
    process.env.OWNER_EMAIL?.toLowerCase(),
  ]);
  if (!user) throw Error("Owner account not found");
  const data = await snapshot(await actorForUser(user.id, "web"));
  const photos = await query(
    "SELECT p.wine_id,encode(p.content,'base64') image_base64,p.content_hash,p.updated_at FROM wine_photos p JOIN wines w ON w.id=p.wine_id WHERE w.household_id=$1",
    [data.household.id],
  );
  const path =
    process.argv[2] ??
    `backups/collection-${new Date().toISOString().replaceAll(":", "-")}.json`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        format: "daily-cellar-domain-v1",
        exported_at: new Date().toISOString(),
        data,
        photos,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    `Domain export saved: ${path}. Auth and OAuth secrets are excluded. Use pg_dump for full disaster recovery.`,
  );
  await getPool().end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
