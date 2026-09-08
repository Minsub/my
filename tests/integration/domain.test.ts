import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { getPool, query } from "../../src/server/db";
import { getAuth } from "../../src/server/auth";
import { actorForUser, mcpActor } from "../../src/server/security";
import { execute, snapshot } from "../../src/server/service";
import { POST } from "../../src/app/api/commands/route";
import {
  PROTOCOL_VERSION_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
} from "@modelcontextprotocol/server";
import { mcpHandler } from "../../src/server/mcp";
import type { Actor } from "../../src/lib/types";
let owner: Actor, member: Actor, outsider: Actor, cookie: string;
const key = () => randomUUID();
const auth = getAuth();
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function signup(email: string, name: string) {
  return auth.api.signUpEmail({
    body: { email, name, password: "Test-password-2026!" },
    asResponse: true,
  });
}
async function wine(quantity = 0) {
  const w = await execute(owner, "wine_create", {
    idempotency_key: key(),
    name: "테스트 와인 " + key().slice(0, 6),
    type: "레드",
  });
  if (quantity)
    await execute(owner, "wine_receive_stock", {
      idempotency_key: key(),
      wine_id: w.id,
      quantity,
      unit_price: 30000,
      purchased_on: "2026-09-01",
    });
  return w;
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw Error(
      "Integration tests require an isolated localhost *_test database",
    );
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
    { env: process.env, stdio: "pipe" },
  );
  await query('TRUNCATE "user",households,jwks,"rateLimit" CASCADE');
  const response = await signup("owner@test.example", "테스트 소유자");
  expect(response.status).toBe(200);
  cookie = cookies(response);
  const user = await response.json();
  owner = await actorForUser(user.user.id, "web");
  await execute(owner, "family_invite", {
    idempotency_key: key(),
    email: "member@test.example",
    role: "member",
  });
  const m = await signup("member@test.example", "가족");
  member = await actorForUser((await m.json()).user.id, "web");
  const otherId = "other-" + key();
  await query(
    'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',
    [otherId, "다른 가족", "other@test.example"],
  );
  const [house] = await query(
    "INSERT INTO households(name) VALUES($1) RETURNING id",
    ["별도 가족"],
  );
  await query(
    "INSERT INTO household_members(household_id,user_id,role) VALUES($1,$2,'owner')",
    [house.id, otherId],
  );
  outsider = await actorForUser(otherId, "web");
});
afterAll(() => getPool().end());
describe("family and domain integrity", () => {
  it("rejects uninvited signup", async () => {
    await expect(
      signup("stranger@test.example", "외부인"),
    ).resolves.toHaveProperty("status", 403);
  });
  it("isolates records across families", async () => {
    const w = await wine(2);
    await expect(
      execute(outsider, "wine_consume", {
        idempotency_key: key(),
        wine_id: w.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await snapshot(outsider)).wines).toHaveLength(0);
  });
  it("enforces scopes on the shared service", async () => {
    await expect(
      execute(
        { ...owner, channel: "mcp", scopes: ["wine:read"] },
        "wine_create",
        { idempotency_key: key(), name: "불가", type: "화이트" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects member family administration", async () => {
    await expect(
      execute(member, "family_invite", {
        idempotency_key: key(),
        email: "evil@test.example",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("only one concurrent consumption of the last bottle succeeds", async () => {
    const w = await wine(1);
    const requests = await Promise.allSettled([
      execute(owner, "wine_consume", {
        idempotency_key: key(),
        wine_id: w.id,
        quantity: 1,
      }),
      execute(member, "wine_consume", {
        idempotency_key: key(),
        wine_id: w.id,
        quantity: 1,
      }),
    ]);
    expect(requests.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await snapshot(owner)).wines.find((x) => x.id === w.id)?.stock,
    ).toBe(0);
  });
  it("retries mutate once and return original results", async () => {
    const w = await wine(3),
      input = { idempotency_key: key(), wine_id: w.id, quantity: 1 };
    const responses = await Promise.all([
      execute(owner, "wine_consume", input),
      execute(owner, "wine_consume", input),
    ]);
    expect(responses[0]).toEqual(responses[1]);
    expect(
      (await snapshot(owner)).wines.find((x) => x.id === w.id)?.stock,
    ).toBe(2);
    await expect(
      execute(owner, "wine_consume", { ...input, quantity: 2 }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("rolls back optional tasting when stock is insufficient", async () => {
    const w = await wine(0);
    await expect(
      execute(owner, "wine_consume", {
        idempotency_key: key(),
        wine_id: w.id,
        quantity: 1,
        tasting: { score: 90, note: "must not persist" },
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(
      (await snapshot(owner)).tastings.filter((t) => t.wine_id === w.id),
    ).toHaveLength(0);
  });
  it("preserves separate purchase dates and prices", async () => {
    const w = await wine(2);
    await execute(owner, "wine_receive_stock", {
      idempotency_key: key(),
      wine_id: w.id,
      quantity: 1,
      unit_price: 35000,
      purchased_on: "2026-09-08",
    });
    const s = await snapshot(owner);
    expect(s.wines.find((x) => x.id === w.id)?.stock).toBe(3);
    expect(
      s.purchases
        .filter((p) => p.wine_id === w.id)
        .map((p) => p.unit_price)
        .sort(),
    ).toEqual([30000, 35000]);
    expect(
      s.purchases
        .filter((p) => p.wine_id === w.id)
        .map((p) => p.purchased_on)
        .sort(),
    ).toEqual(["2026-09-01", "2026-09-08"]);
    expect(
      s.events
        .filter((e) => e.wine_id === w.id)
        .map((e) => e.occurred_on)
        .sort(),
    ).toEqual(["2026-09-01", "2026-09-08"]);
  });
  it("reverses consumption once without deleting history", async () => {
    const w = await wine(1);
    const consumed = await execute(member, "wine_consume", {
      idempotency_key: key(),
      wine_id: w.id,
      quantity: 1,
    });
    const event = consumed.event as { id: string };
    await execute(member, "wine_reverse_event", {
      idempotency_key: key(),
      event_id: event.id,
      reason: "잘못 입력",
    });
    await expect(
      execute(member, "wine_reverse_event", {
        idempotency_key: key(),
        event_id: event.id,
        reason: "또 취소",
      }),
    ).rejects.toMatchObject({ code: "23505" });
    const s = await snapshot(owner);
    expect(s.wines.find((x) => x.id === w.id)?.stock).toBe(1);
    expect(s.events.filter((e) => e.wine_id === w.id)).toHaveLength(3);
  });
  it("keeps preferences per user and rejects stale updates", async () => {
    const brand = await execute(owner, "coffee_create_brand", {
      idempotency_key: key(),
      name: "로스터 " + key(),
    });
    const bean = await execute(owner, "coffee_create_bean", {
      idempotency_key: key(),
      brand_id: brand.id,
      name: "블렌드",
    });
    const input = {
      idempotency_key: key(),
      bean_id: bean.id,
      expected_version: null,
      status: null,
      recommendation: "추천",
    };
    await execute(owner, "coffee_save_preference", input);
    await execute(member, "coffee_save_preference", {
      ...input,
      idempotency_key: key(),
      recommendation: "비추천",
    });
    await expect(
      execute(owner, "coffee_save_preference", {
        ...input,
        idempotency_key: key(),
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(
      (await snapshot(owner)).preferences.filter((p) => p.bean_id === bean.id),
    ).toHaveLength(2);
  });
  it("rejects browser writes from an untrusted origin", async () => {
    const r = await POST(
      new Request("http://localhost:3000/api/commands", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operation: "wine_create",
          input: { idempotency_key: key(), name: "attacker", type: "레드" },
        }),
      }),
    );
    expect(r.status).toBe(403);
  });
  it("round-trips OAuth discovery, PKCE, consent, refresh, MCP and revocation", async () => {
    const register = await auth.handler(
      new Request("http://localhost:3000/api/auth/oauth2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Local MCP test",
          redirect_uris: ["http://127.0.0.1:8888/callback"],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: "openid offline_access wine:read wine:write",
          application_type: "native",
        }),
      }),
    );
    const client = await register.json();
    expect(register.status, JSON.stringify(client)).toBeLessThan(300);
    const verifier = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:8888/callback",
      scope: "openid offline_access wine:read wine:write",
      resource: "http://localhost:3000/api/mcp",
      state: "test-state",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    const authorize = await auth.handler(
      new Request(`http://localhost:3000/api/auth/oauth2/authorize?${params}`, {
        headers: { cookie },
      }),
    );
    expect(authorize.status).toBe(302);
    const location = authorize.headers.get("location")!;
    expect(location).toContain("/consent");
    const consentResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/oauth2/consent", {
        method: "POST",
        headers: {
          cookie,
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accept: true,
          oauth_query: new URL(location, "http://localhost:3000").search.slice(
            1,
          ),
        }),
      }),
    );
    const consent = await consentResponse.json();
    expect(consentResponse.status, JSON.stringify(consent)).toBe(200);
    const code = new URL(consent.url).searchParams.get("code");
    expect(code).toBeTruthy();
    const token = await auth.handler(
      new Request("http://localhost:3000/api/auth/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: client.client_id,
          code: code!,
          redirect_uri: "http://127.0.0.1:8888/callback",
          code_verifier: verifier,
          resource: "http://localhost:3000/api/mcp",
        }),
      }),
    );
    const tokens = await token.json();
    expect(token.status, JSON.stringify(tokens)).toBe(200);
    const request = new Request("http://localhost:3000/api/mcp", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const actor = await mcpActor(request);
    expect(actor.userId).toBe(owner.userId);
    expect(actor.scopes).toContain("wine:write");
    const response = await mcpHandler(actor)(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/list",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {
            _meta: {
              [PROTOCOL_VERSION_META_KEY]: "2026-07-28",
              [CLIENT_CAPABILITIES_META_KEY]: {},
            },
          },
        }),
      }),
    );
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain("wine_consume");
    expect(body).not.toContain("coffee_create_bean");
    const legacy = await mcpHandler(actor)(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    expect(legacy.status, await legacy.text()).toBe(200);
    const toolResponse = await mcpHandler(actor)(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "wine_create",
            arguments: {
              idempotency_key: key(),
              name: "OAuth MCP에서 등록",
              type: "화이트",
            },
          },
        }),
      }),
    );
    const toolBody = await toolResponse.text();
    expect(toolResponse.status, toolBody).toBe(200);
    expect(toolBody).not.toContain('"isError":true');
    expect(
      (await snapshot(owner)).wines.some(
        (w) => w.name === "OAuth MCP에서 등록",
      ),
    ).toBe(true);
    const refreshed = await auth.handler(
      new Request("http://localhost:3000/api/auth/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: client.client_id,
          refresh_token: tokens.refresh_token,
          resource: "http://localhost:3000/api/mcp",
        }),
      }),
    );
    const renewed = await refreshed.json();
    expect(refreshed.status, JSON.stringify(renewed)).toBe(200);
    const consents = await auth.api.getOAuthConsents({
      headers: new Headers({ cookie }),
    });
    const granted = consents.find((c) => c.clientId === client.client_id);
    expect(granted).toBeTruthy();
    await auth.api.disconnectDailyClient({
      headers: new Headers({ cookie }),
      body: { id: granted!.id },
    });
    await expect(
      mcpActor(
        new Request("http://localhost:3000/api/mcp", {
          headers: { Authorization: `Bearer ${renewed.access_token}` },
        }),
      ),
    ).rejects.toBeDefined();
    const revokedRefresh = await auth.handler(
      new Request("http://localhost:3000/api/auth/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: client.client_id,
          refresh_token: renewed.refresh_token,
          resource: "http://localhost:3000/api/mcp",
        }),
      }),
    );
    expect(revokedRefresh.status).toBe(400);
    // Restoring consent cannot resurrect credentials issued before disconnect.
    await query(
      'INSERT INTO "oauthConsent"(id,"clientId","userId",scopes,"createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())',
      [key(), client.client_id, owner.userId, JSON.stringify(granted!.scopes)],
    );
    await expect(
      mcpActor(
        new Request("http://localhost:3000/api/mcp", {
          headers: { Authorization: `Bearer ${renewed.access_token}` },
        }),
      ),
    ).rejects.toBeDefined();
  });
  it("revoking a member immediately blocks existing actors", async () => {
    await execute(owner, "family_remove", {
      idempotency_key: key(),
      user_id: member.userId,
    });
    await expect(snapshot(member)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
