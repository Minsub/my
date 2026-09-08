import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const { getAuth, localPasswordAuth } = await import("../src/server/auth");
  if (!localPasswordAuth())
    throw Error(
      "This helper only runs with local password auth on localhost, outside Vercel.",
    );
  const { query, getPool } = await import("../src/server/db");
  const email = process.env.OWNER_EMAIL!;
  if (!(await query('SELECT id FROM "user" WHERE email=$1', [email])).length)
    await getAuth().api.signUpEmail({
      body: { email, password: "Local-demo-password-2026!", name: "나" },
    });
  const { seed } = await import("./seed");
  await seed();
  await getPool().end();
  console.log(
    "Local owner and coffee collection ready. Local password is documented in README (never enabled on Vercel).",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
