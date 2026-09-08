import { AppShell } from "@/components/app-shell";
import { demoSnapshot } from "@/lib/demo";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const view = typeof p.view === "string" ? p.view : "/";
  return <AppShell key={view} initial={demoSnapshot()} path={view} demo />;
}
