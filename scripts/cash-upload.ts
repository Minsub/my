import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { query, getPool } from "../src/server/db";
import { actorForUser } from "../src/server/security";
import { saveCashFile, cashFiles, downloadCash } from "../src/server/cash";
async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length)
    throw Error("Usage: tsx scripts/cash-upload.ts <file.xlsx> ...");
  const [user] = await query('SELECT id FROM "user" WHERE lower(email)=$1', [
    process.env.OWNER_EMAIL?.toLowerCase(),
  ]);
  if (!user) throw Error("Owner account not found");
  const actor = await actorForUser(user.id, "web");
  for (const path of paths) {
    const content = await readFile(path),
      name = basename(path);
    const preview = await saveCashFile(actor, name, content, 0, true);
    await saveCashFile(actor, name, content, preview.expectedVersion);
    const file = (await cashFiles(actor)).find(
      (f) =>
        f.filename ===
        name
          .normalize("NFC")
          .trim()
          .replace(/\.xlsx$/i, ".xlsx"),
    );
    if (!file) throw Error("Saved file missing");
    const stored = await downloadCash(actor, file.id);
    if (
      createHash("sha256").update(stored.content).digest("hex") !==
      createHash("sha256").update(content).digest("hex")
    )
      throw Error("File verification failed");
    console.log(
      JSON.stringify({
        filename: file.filename,
        rows: file.metadata.rows,
        first: file.metadata.firstDate,
        last: file.metadata.lastDate,
        bytes: file.bytes,
        unchanged: preview.unchanged,
        verified: true,
      }),
    );
  }
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Upload failed");
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
