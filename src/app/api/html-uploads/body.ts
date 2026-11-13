import { AppError } from "@/server/security";
// 3MB HTML이 JSON 문자열로 늘어나도 Vercel 요청 한도(4.5MB) 안에서 끊는다.
const MAX_BODY = 4_400_000;
export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY)
    throw new AppError("TOO_LARGE", "HTML은 3MB까지 올릴 수 있습니다.", 413);
  const body = await request.text();
  if (body.length > MAX_BODY)
    throw new AppError("TOO_LARGE", "HTML은 3MB까지 올릴 수 있습니다.", 413);
  return JSON.parse(body);
}
