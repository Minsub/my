import { AppShell } from "@/components/app-shell";
import { demoSnapshot } from "@/lib/demo";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const view = typeof p.view === "string" ? p.view : "/";
  const initialQuery = Object.fromEntries(
    Object.entries(p).filter(
      ([key, value]) => key !== "view" && typeof value === "string",
    ),
  ) as Record<string, string>;
  return (
    <AppShell
      key={view + JSON.stringify(initialQuery)}
      initial={demoSnapshot()}
      path={view}
      initialQuery={initialQuery}
      demo
    />
  );
}
