import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { webActor } from "@/server/security";
import { ConsentScreen } from "@/components/auth-screens";
export const dynamic = "force-dynamic";
export default async function Consent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  try {
    await webActor(await headers());
  } catch {
    redirect("/login");
  }
  return (
    <ConsentScreen
      scopes={String(params.scope ?? "")
        .split(" ")
        .filter(Boolean)}
      client={String(params.client_id ?? "AI 연결 요청")}
    />
  );
}
