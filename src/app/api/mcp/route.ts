import { mcpHandler } from "@/server/mcp";
import {
  mcpActor,
  rateLimit,
  AppError,
  errorResponse,
} from "@/server/security";
import { appUrl, configured } from "@/server/auth";
export const runtime = "nodejs";
export const maxDuration = 30;
async function handler(request: Request) {
  if (!configured())
    return Response.json({ error: "Service not configured" }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== appUrl())
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    let actor;
    try {
      actor = await mcpActor(request);
    } catch {
      throw new AppError("UNAUTHORIZED", "AI 계정을 연결해주세요.", 401);
    }
    await rateLimit(`mcp:${actor.userId}`);
    return await mcpHandler(actor)(request);
  } catch (e) {
    if (e instanceof AppError && e.status === 401)
      return Response.json(
        { error: "unauthorized" },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer resource_metadata="${appUrl()}/.well-known/oauth-protected-resource", scope="coffee:read coffee:write wine:read wine:write"`,
          },
        },
      );
    return errorResponse(e);
  }
}
export { handler as GET, handler as POST, handler as DELETE };
