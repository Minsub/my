import { getAuth, appUrl, configured, localPasswordAuth } from "./auth";
import { query } from "./db";
import { allScopes, type Actor, type Scope } from "@/lib/types";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireScope(actor: Actor, scope: Scope) {
  if (!actor.scopes.includes(scope))
    throw new AppError("FORBIDDEN", "이 작업의 권한이 없습니다.", 403);
}
export async function actorForUser(
  userId: string,
  channel: "web" | "mcp",
  scopes: Scope[] = allScopes,
  clientId?: string,
): Promise<Actor> {
  const [member] = await query(
    "SELECT * FROM household_members WHERE user_id=$1 AND active=true",
    [userId],
  );
  if (!member)
    throw new AppError("FORBIDDEN", "가족 접근 권한이 없습니다.", 403);
  return {
    userId,
    householdId: member.household_id,
    role: member.role,
    scopes,
    channel,
    clientId,
  };
}
export async function webActor(headers: Headers): Promise<Actor> {
  if (!configured())
    throw new AppError("SETUP_REQUIRED", "서비스 설정이 필요합니다.", 503);
  const session = await getAuth().api.getSession({ headers });
  if (!session || (!session.user.emailVerified && !localPasswordAuth()))
    throw new AppError("UNAUTHORIZED", "로그인이 필요합니다.", 401);
  return actorForUser(session.user.id, "web");
}
export async function mcpActor(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!token)
    throw new AppError("UNAUTHORIZED", "AI 계정을 연결해주세요.", 401);
  const payload = await getAuth().api.verifyDailyMcpToken({ body: { token } });
  return actorForUser(
    payload.sub!,
    "mcp",
    String(payload.scope ?? "")
      .split(" ")
      .filter((x): x is Scope => allScopes.includes(x as Scope)),
    String(payload.client_id ?? payload.azp ?? ""),
  );
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl())
    throw new AppError("FORBIDDEN", "허용되지 않은 요청입니다.", 403);
}
export async function rateLimit(key: string, max = 120) {
  const [row] = await query(
    `INSERT INTO request_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.count+1 END,
    expires_at=CASE WHEN request_limits.expires_at<now() THEN now()+interval '1 minute' ELSE request_limits.expires_at END RETURNING count`,
    [key],
  );
  if (row.count > max)
    throw new AppError("RATE_LIMITED", "잠시 후 다시 시도해주세요.", 429);
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "올바른 JSON 요청이 필요합니다.",
        },
      },
      { status: 400 },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "입력값을 확인해주세요.",
          fields: error.issues.map((x) => x.path.join(".")),
        },
      },
      { status: 400 },
    );
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return Response.json(
      { error: { code: "DUPLICATE", message: "이미 등록된 항목입니다." } },
      { status: 409 },
    );
  if (code === "23503")
    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "연결할 항목을 찾을 수 없습니다.",
        },
      },
      { status: 404 },
    );
  console.error("Request failed", {
    name: error instanceof Error ? error.name : "Unknown",
    code,
  });
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
    },
    { status: 500 },
  );
}
