import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import { jwt } from "better-auth/plugins";
import {
  getOAuthProviderApi,
  oauthProvider,
  type OAuthOptions,
} from "@better-auth/oauth-provider";
import { z } from "zod";
import { getPool, query, transaction } from "./db";
import { allScopes } from "@/lib/types";
export const configured = () =>
  Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_URL &&
    process.env.OWNER_EMAIL,
  );
export function appUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
export function localPasswordAuth() {
  return (
    process.env.LOCAL_PASSWORD_AUTH === "true" &&
    !process.env.VERCEL &&
    ["localhost", "127.0.0.1"].includes(new URL(appUrl()).hostname)
  );
}
export function authOptions() {
  const oauthOptions: OAuthOptions<string[]> = {
    loginPage: "/login",
    consentPage: "/consent",
    scopes: ["openid", "profile", "email", "offline_access", ...allScopes],
    resources: [
      {
        identifier: `${appUrl()}/api/mcp`,
        allowedScopes: allScopes,
        accessTokenTtl: 900,
      },
    ],
    clientRegistrationDefaultResources: [`${appUrl()}/api/mcp`],
    grantTypes: ["authorization_code", "refresh_token"],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 60 * 60 * 24 * 30,
    clientPrivileges: () => false,
    resourcePrivileges: () => false,
  };
  return {
    appName: "취향의 기록",
    baseURL: appUrl(),
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: getPool(),
    trustedOrigins: [appUrl()],
    disabledPaths: ["/token", "/oauth2/delete-consent"],
    emailAndPassword: { enabled: localPasswordAuth(), minPasswordLength: 12 },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database" as const,
      window: 60,
      max: 60,
    },
    account: { accountLinking: { enabled: false } },
    databaseHooks: {
      user: {
        create: {
          before: async (user: { email: string }) => {
            const email = user.email.toLowerCase().trim();
            if (
              email !== process.env.OWNER_EMAIL?.toLowerCase().trim() &&
              !(
                await query(
                  "SELECT id FROM household_invites WHERE email=$1 AND active=true",
                  [email],
                )
              ).length
            )
              throw new APIError("FORBIDDEN", {
                message: "초대된 가족 계정만 사용할 수 있습니다.",
              });
          },
          after: async (user: {
            id: string;
            email: string;
            emailVerified: boolean;
          }) => {
            if (!user.emailVerified && !localPasswordAuth()) return;
            await provisionMember(user.id, user.email);
          },
        },
      },
    },
    plugins: [
      jwt({ jwt: { issuer: `${appUrl()}/api/auth` } }),
      oauthProvider(oauthOptions),
      {
        id: "daily-mcp-verification",
        endpoints: {
          disconnectDailyClient: createAuthEndpoint(
            "/daily/disconnect",
            {
              method: "POST",
              use: [sessionMiddleware],
              body: z.object({ id: z.string() }),
            },
            async (ctx) => {
              await transaction(async (client) => {
                const [consent] = await query(
                  'SELECT * FROM "oauthConsent" WHERE id=$1 AND "userId"=$2 FOR UPDATE',
                  [ctx.body.id, ctx.context.session.user.id],
                  client,
                );
                if (!consent)
                  throw new APIError("NOT_FOUND", {
                    message: "Connection not found",
                  });
                await query(
                  "INSERT INTO oauth_revocations(user_id,client_id,revoked_before) VALUES($1,$2,floor(extract(epoch from clock_timestamp()))) ON CONFLICT(user_id,client_id) DO UPDATE SET revoked_before=EXCLUDED.revoked_before",
                  [consent.userId, consent.clientId],
                  client,
                );
                await query(
                  'DELETE FROM "oauthRefreshToken" WHERE "userId"=$1 AND "clientId"=$2',
                  [consent.userId, consent.clientId],
                  client,
                );
                await query(
                  'DELETE FROM "oauthAccessToken" WHERE "userId"=$1 AND "clientId"=$2',
                  [consent.userId, consent.clientId],
                  client,
                );
                await query(
                  'DELETE FROM "oauthConsent" WHERE id=$1',
                  [consent.id],
                  client,
                );
              });
              return { success: true };
            },
          ),
          verifyDailyMcpToken: createAuthEndpoint.serverOnly(
            { method: "POST", body: z.object({ token: z.string() }) },
            async (ctx) => {
              const payload = await getOAuthProviderApi(
                ctx,
                oauthOptions,
              ).requireActiveAccessToken(ctx.body.token);
              const aud = Array.isArray(payload.aud)
                ? payload.aud
                : [payload.aud];
              if (
                !aud.includes(`${appUrl()}/api/mcp`) ||
                payload.iss !== `${appUrl()}/api/auth` ||
                !payload.sub ||
                payload.cnf
              )
                throw new APIError("UNAUTHORIZED", {
                  message: "Invalid resource token",
                });
              const clientId = String(payload.client_id ?? payload.azp ?? "");
              const [consent] = await query(
                'SELECT scopes FROM "oauthConsent" WHERE "userId"=$1 AND "clientId"=$2',
                [payload.sub, clientId],
              );
              const [revocation] = await query(
                "SELECT revoked_before FROM oauth_revocations WHERE user_id=$1 AND client_id=$2",
                [payload.sub, clientId],
              );
              if (
                !consent ||
                String(payload.scope ?? "")
                  .split(" ")
                  .some((scope) => !consent.scopes.includes(scope)) ||
                (revocation &&
                  Number(payload.iat ?? 0) <= Number(revocation.revoked_before))
              )
                throw new APIError("UNAUTHORIZED", {
                  message: "Connection revoked",
                });
              return payload;
            },
          ),
        },
      },
    ],
  };
}
let auth:
  ReturnType<typeof betterAuth<ReturnType<typeof authOptions>>> | undefined;
export function getAuth() {
  if (!configured()) throw new Error("Authentication is not configured");
  return (auth ??= betterAuth(authOptions()));
}
export async function provisionMember(userId: string, email: string) {
  return transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('daily-family-bootstrap'))",
    );
    const existing = await query(
      "SELECT * FROM household_members WHERE user_id=$1",
      [userId],
      client,
    );
    if (existing.length) return;
    if (email.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase().trim()) {
      let [house] = await query(
        "SELECT id FROM households ORDER BY created_at LIMIT 1",
        [],
        client,
      );
      if (!house)
        [house] = await query(
          "INSERT INTO households(name) VALUES($1) RETURNING id",
          [process.env.HOUSEHOLD_NAME ?? "우리 집"],
          client,
        );
      await query(
        "INSERT INTO household_members(household_id,user_id,role) VALUES($1,$2,'owner')",
        [house.id, userId],
        client,
      );
    } else {
      const [invite] = await query(
        "SELECT * FROM household_invites WHERE lower(email)=$1 AND active=true LIMIT 1",
        [email.toLowerCase()],
        client,
      );
      if (invite)
        await query(
          "INSERT INTO household_members(household_id,user_id,role) VALUES($1,$2,$3)",
          [invite.household_id, userId, invite.role],
          client,
        );
    }
  });
}
