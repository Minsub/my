import { execFileSync } from "node:child_process";
import { getPool, query } from "../../src/server/db";
import { getAuth } from "../../src/server/auth";
import { seed } from "../../scripts/seed";
export default async function setup() {
  const db = new URL(process.env.DATABASE_URL!);
  if (
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    !db.pathname.endsWith("_test")
  )
    throw Error("E2E requires an isolated localhost *_test database");
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
    { env: process.env, stdio: "pipe" },
  );
  await query('TRUNCATE "user",households,jwks,"rateLimit" CASCADE');
  await getAuth().api.signUpEmail({
    body: {
      email: process.env.OWNER_EMAIL!,
      name: "우리 가족",
      password: "Test-password-2026!",
    },
  });
  await seed();
  await getPool().end();
}
