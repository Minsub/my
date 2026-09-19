"use client";
import Link from "next/link";
import { ArrowUpRight, LineChart, Wallet, FileCode2 } from "lucide-react";
import { assetSubMenus } from "@/lib/assets";
const icons: Record<string, typeof Wallet> = {
  status: LineChart,
  cash: Wallet,
  "cash-old": FileCode2,
};
export function AssetHub({ href }: { href: (path: string) => string }) {
  return (
    <div className="asset-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONO / ASSETS</span>
          <h1>
            자산관리<span className="heading-dot">.</span>
          </h1>
          <p>가계부와 자산 현황을 한곳에서 관리합니다.</p>
        </div>
      </div>
      <section className="asset-menu" aria-label="자산관리 하위 화면">
        {assetSubMenus.map((menu) => {
          const Icon = icons[menu.key] ?? Wallet;
          return (
            <Link
              className="asset-menu-card"
              href={href(menu.path)}
              key={menu.key}
            >
              <span className="asset-menu-icon">
                <Icon size={22} />
              </span>
              <div>
                <h2>{menu.title}</h2>
                <p>{menu.description}</p>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
