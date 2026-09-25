"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Coffee,
  Timer,
  Wine,
  type LucideIcon,
} from "lucide-react";
export type HubItem = {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
};
// 한 메뉴 아래 하위 화면을 카드로 나열한다. 자산관리·취미·꼬미가 같은 모양을 쓴다.
export function MenuHub({
  eyebrow,
  title,
  description,
  items,
  href,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: HubItem[];
  href: (path: string) => string;
}) {
  return (
    <div className="hub-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>
            {title}
            <span className="heading-dot">.</span>
          </h1>
          <p>{description}</p>
        </div>
      </div>
      <section className="hub-menu" aria-label={`${title} 하위 화면`}>
        {items.map((item) => (
          <Link
            className="hub-menu-card"
            href={href(item.path)}
            key={item.path}
          >
            <span className="hub-menu-icon">
              <item.icon size={22} />
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </section>
    </div>
  );
}
export const hobbyMenus: HubItem[] = [
  {
    path: "/coffee",
    title: "커피 원두",
    description: "원두·브랜드·머신 추출 설정과 구성원별 평가를 봅니다.",
    icon: Coffee,
  },
  {
    path: "/wine",
    title: "와인 셀러",
    description: "보유 와인, 입고·소비, 시음 기록과 와인잔을 관리합니다.",
    icon: Wine,
  },
];
export const kkomiMenus: HubItem[] = [
  {
    path: "/baby/pregnancy",
    title: "임신 중 통증 기록",
    description: "배뭉침·통증의 시작과 종료, 출혈을 기록하고 주기를 봅니다.",
    icon: Timer,
  },
];
