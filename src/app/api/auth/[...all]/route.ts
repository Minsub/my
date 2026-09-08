import { getAuth, configured } from "@/server/auth";
export const runtime = "nodejs";
async function handler(request: Request) {
  if (!configured())
    return Response.json(
      { error: "서비스 설정이 필요합니다." },
      { status: 503 },
    );
  return getAuth().handler(request);
}
export { handler as GET, handler as POST };
