import { appUrl } from "@/server/auth";
export async function GET() {
  return Response.json(
    {
      resource: `${appUrl()}/api/mcp`,
      authorization_servers: [`${appUrl()}/api/auth`],
      scopes_supported: [
        "coffee:read",
        "coffee:write",
        "wine:read",
        "wine:write",
      ],
      bearer_methods_supported: ["header"],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
