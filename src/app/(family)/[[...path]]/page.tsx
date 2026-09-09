import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { configured } from "@/server/auth";
import { webActor, AppError } from "@/server/security";
import { snapshot } from "@/server/service";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path: parts = [] } = await params;
  const path = "/" + parts.join("/");
  if (
    ![
      "/",
      "/coffee",
      "/coffee/brands",
      "/wine",
      "/wine/glasses",
      "/settings",
    ].includes(path) &&
    !/^\/(coffee\/beans|wine)\/[0-9a-f-]{36}$/.test(path)
  )
    notFound();
  if (!configured()) redirect("/setup");
  let actor;
  try {
    actor = await webActor(await headers());
  } catch (e) {
    if (e instanceof AppError) redirect("/login");
    throw e;
  }
  const data = await snapshot(actor);
  const raw = await searchParams;
  const q = Object.fromEntries(
    Object.entries(raw).filter(
      (x): x is [string, string] => typeof x[1] === "string",
    ),
  );
  return (
    <AppShell
      key={path + JSON.stringify(q)}
      initial={data}
      path={path}
      initialQuery={q}
    />
  );
}
