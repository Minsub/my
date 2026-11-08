"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CakeSlice,
  Coffee,
  CookingPot,
  Refrigerator,
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
  {
    path: "/hobby/baking",
    title: "베이킹",
    description: "케이크·구움과자 레시피를 재료·오븐·공정별로 봅니다.",
    icon: CakeSlice,
  },
  {
    path: "/hobby/meals",
    title: "집밥",
    description: "집에서 해먹을 요리를 재료·카테고리·태그로 모아보고 고릅니다.",
    icon: CookingPot,
  },
  {
    path: "/hobby/fridge",
    title: "냉장고",
    description:
      "냉장·냉동실에 있는 재료와 그걸로 해먹을 집밥을 한 화면에서 봅니다.",
    icon: Refrigerator,
  },
];
export const kkomiMenus: HubItem[] = [
  {
    path: "/baby/pregnancy",
    title: "임신 기록",
    description: "배뭉침·통증 주기, 출혈, 진료·검사 기록을 한곳에서 봅니다.",
    icon: Timer,
  },
];
