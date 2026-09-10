import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { configured } from "@/server/auth";
import { webActor, AppError } from "@/server/security";
import { snapshot } from "@/server/service";
import { AppShell } from "@/components/app-shell";
import { findHtmlPage } from "@/lib/html-pages";
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
  const isRegisteredHtml =
    /^\/etc\/html\/[^/]+$/.test(path) &&
    Boolean(findHtmlPage(parts[2] ?? ""));
  if (
    ![
      "/",
      "/coffee",
      "/coffee/brands",
      "/wine",
      "/wine/glasses",
      "/settings",
      "/cash",
      "/cash/old",
      "/etc/html",
    ].includes(path) &&
    !isRegisteredHtml &&
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
  if (path === "/cash") {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) value.forEach((v) => p.append(key, v));
      else if (value) p.set(key, value);
    }
    q.cashQuery = p.toString();
  }
  return (
    <AppShell
      key={path + JSON.stringify(q)}
      initial={data}
      path={path}
      initialQuery={q}
    />
  );
}
