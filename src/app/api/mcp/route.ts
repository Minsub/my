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
    let bounded = request;
    if (request.method === "POST" && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2900000) {
          await reader.cancel();
          throw new AppError("TOO_LARGE", "MCP 요청이 너무 큽니다.", 413);
        }
        chunks.push(value);
      }
      bounded = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: Buffer.concat(chunks),
      });
    }
    return await mcpHandler(actor)(bounded);
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
