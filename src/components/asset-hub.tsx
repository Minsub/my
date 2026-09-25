"use client";
import { LineChart, Wallet, FileCode2 } from "lucide-react";
import { assetSubMenus } from "@/lib/assets";
import { MenuHub } from "./menu-hub";
const icons: Record<string, typeof Wallet> = {
  status: LineChart,
  cash: Wallet,
  "cash-old": FileCode2,
};
export function AssetHub({ href }: { href: (path: string) => string }) {
  return (
    <MenuHub
      eyebrow="MONO / ASSETS"
      title="자산관리"
      description="가계부와 자산 현황을 한곳에서 관리합니다."
      items={assetSubMenus.map((m) => ({ ...m, icon: icons[m.key] ?? Wallet }))}
      href={href}
    />
  );
}
