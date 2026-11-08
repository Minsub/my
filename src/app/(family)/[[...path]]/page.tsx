import type { Viewport } from "next";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { configured } from "@/server/auth";
import { webActor, AppError } from "@/server/security";
import { snapshot } from "@/server/service";
import { AppShell } from "@/components/app-shell";
import { findHtmlPage } from "@/lib/html-pages";
import { findBakingRecipe } from "@/lib/baking";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 시계는 검정 전체 화면이라 브라우저·홈 화면 앱 상단 색도 검정으로 맞춘다.
export async function generateViewport({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Viewport> {
  const { path: parts = [] } = await params;
  return parts.join("/") === "hobby/clock/view"
    ? { themeColor: "#000000" }
    : {};
}
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
    /^\/etc\/html\/[^/]+$/.test(path) && Boolean(findHtmlPage(parts[2] ?? ""));
  const isBakingRecipe =
    /^\/hobby\/baking\/[^/]+$/.test(path) &&
    Boolean(findBakingRecipe(parts[2]));
  if (
    ![
      "/",
      "/coffee",
      "/coffee/brands",
      "/wine",
      "/wine/glasses",
      "/wine/shares",
      "/wine/cellar",
      "/settings",
      "/cash",
      "/cash/old",
      "/assets",
      "/assets/status",
      "/assets/trend",
      "/assets/records",
      "/assets/strategy",
      "/etc/html",
      "/hobby",
      "/hobby/baking",
      "/hobby/meals",
      "/hobby/fridge",
      "/hobby/clock",
      "/hobby/clock/view",
      "/hobby/clock/settings",
      "/baby",
      "/baby/pregnancy",
    ].includes(path) &&
    !isRegisteredHtml &&
    !isBakingRecipe &&
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
  if (path === "/cash" || path.startsWith("/assets/")) {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) value.forEach((v) => p.append(key, v));
      else if (value) p.set(key, value);
    }
    if (path === "/cash") q.cashQuery = p.toString();
    else q.assetQuery = p.toString();
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
