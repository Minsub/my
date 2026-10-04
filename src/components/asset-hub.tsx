"use client";
import { LineChart, Wallet, FileCode2, CalendarRange } from "lucide-react";
import { assetSubMenus } from "@/lib/assets";
import { MenuHub } from "./menu-hub";
const icons: Record<string, typeof Wallet> = {
  status: LineChart,
  strategy: CalendarRange,
  cash: Wallet,
  "cash-old": FileCode2,
};
export function AssetHub({ href }: { href: (path: string) => string }) {
  return (
    <MenuHub
      eyebrow="MONO / ASSETS"
      title="자산관리"
      description="가계부·자산 현황·분할매수 전략을 한곳에서 관리합니다."
      items={assetSubMenus.map((m) => ({ ...m, icon: icons[m.key] ?? Wallet }))}
      href={href}
    />
  );
}
