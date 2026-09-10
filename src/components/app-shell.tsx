"use client";
import { CashOld } from "./cash-old";
import { CashDashboard } from "./cash-dashboard";
import { HtmlPageList, HtmlPageView } from "./html-pages";
import { WorkspaceHome } from "./workspace-home";
import { WineCellar } from "./wine-cellar";
import { WinePhotoUpload } from "./wine-photo-upload";
import { wineFacts } from "@/lib/wine-cellar";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation deliberately clears all cached family data when a session ends. */
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  Coffee,
  ExternalLink,
  Heart,
  Home,
  Wallet,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wine as WineIcon,
  X,
  GlassWater,
  Archive,
  FileCode2,
  Undo2,
  Pencil,
} from "lucide-react";
import { findHtmlPage } from "@/lib/html-pages";
import type { Bean, Snapshot, Wine } from "@/lib/types";
import { wineTypes, glassTypes } from "@/lib/types";
import { money, kgPrice, today, dateLabel, vintageLabel } from "@/lib/format";
import type { Operation } from "@/lib/contracts";
import { ProductArt } from "./product-art";
import { RecordForm, type FormSpec, type Field } from "./record-form";
import { ConnectionSettings } from "./connections";
const nav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/coffee", label: "커피 원두", icon: Coffee },
  { href: "/wine", label: "와인 셀러", icon: WineIcon },
  { href: "/cash", label: "가계부", icon: Wallet },
  { href: "/etc/html", label: "기타", icon: FileCode2 },
  { href: "/settings", label: "설정", icon: Settings },
];
const select = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const number = (name: string, label: string, value?: number | null): Field => ({
  name,
  label,
  type: "number",
  value,
});
const txt = (
  name: string,
  label: string,
  value?: string,
  required = false,
): Field => ({ name, label, value, required });
const area = (name: string, label: string, value?: string): Field => ({
  name,
  label,
  value,
  type: "textarea",
});
const options = (
  name: string,
  label: string,
  values: string[],
  value?: string | null,
  required = false,
): Field => ({
  name,
  label,
  type: "select",
  options: select(values),
  value,
  required,
});
function Tag({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function AppShell({
  initial,
  path = "/",
  demo = false,
  initialQuery = {},
}: {
  initial: Snapshot;
  path?: string;
  demo?: boolean;
  initialQuery?: Record<string, string>;
}) {
  const [data, setData] = useState(initial),
    [form, setForm] = useState<FormSpec | null>(null),
    [toast, setToast] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(initialQuery.q ?? ""),
    [brand, setBrand] = useState(initialQuery.brand ?? ""),
    [recommend, setRecommend] = useState(initialQuery.recommend ?? ""),
    [status, setStatus] = useState(initialQuery.status ?? ""),
    [person, setPerson] = useState(initialQuery.person ?? initial.user.id),
    [stockOnly, setStockOnly] = useState(initialQuery.stock !== "all"),
    [archived, setArchived] = useState(initialQuery.archived === "true"),
    [coffeeSort, setCoffeeSort] = useState(initialQuery.sort ?? "name");
  const active = path.startsWith("/coffee")
    ? "/coffee"
    : path.startsWith("/cash")
      ? "/cash"
      : path.startsWith("/etc")
        ? "/etc/html"
      : path.startsWith("/wine")
        ? "/wine"
        : path.startsWith("/settings")
          ? "/settings"
          : "/";
  const href = (url: string) => {
    if (!demo) return url;
    const target = new URL(url, "https://mono.local");
    target.searchParams.set("view", target.pathname);
    return `/demo?${target.searchParams}${target.hash}`;
  };
  const coffeeQuery = new URLSearchParams({
    q: search,
    brand,
    recommend,
    status,
    person,
    archived: String(archived),
    sort: coffeeSort,
  }).toString();
  const coffeeListUrl = `/coffee?${coffeeQuery}`;
  const updateFilter = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 5000);
  };
  async function reload() {
    if (demo) {
      inform("문서에 있는 초기 목록을 미리 보고 있습니다.");
      return;
    }
    setRefreshing(true);
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      if (!r.ok) {
        if (r.status === 401) window.location.assign("/login");
        throw Error("새로고침하지 못했습니다.");
      }
      setData(await r.json());
    } catch (e) {
      inform((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function save(operation: Operation, input: Record<string, unknown>) {
    if (demo)
      throw Error("미리보기에서는 저장하지 않습니다. 로그인 후 이용해주세요.");
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, input }),
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
    await reload();
    if (operation === "wine_create") {
      setStockOnly(false);
      updateFilter("stock", "all");
    }
    inform("기록을 저장했습니다.");
  }
  const open = (spec: FormSpec) => {
    if (demo) {
      inform("둘러보기 화면입니다. 로그인하면 기록을 저장할 수 있어요.");
      return;
    }
    setForm(spec);
  };
  const ownPrefs = data.preferences.filter(
    (p) => person === "all" || p.user_id === person,
  );
  const myPref = (bean: Bean) =>
    data.preferences.find(
      (p) => p.bean_id === bean.id && p.user_id === data.user.id,
    );
  const myBrew = (bean: Bean) =>
    data.brews.find((b) => b.bean_id === bean.id && b.user_id === data.user.id);
  const brandName = (bean: Bean) =>
    data.brands.find((b) => b.id === bean.brand_id)?.name ?? "";
  const memberName = (id: string) =>
    data.members.find((m) => m.user_id === id)?.name ?? "가족";
  const editAllowed = (row: { created_by?: string | null }) =>
    data.user.role === "owner" || row.created_by === data.user.id;
  const beans = data.beans
    .filter(
      (b) =>
        b.archived === archived &&
        (!search ||
          (b.name + " " + brandName(b) + " " + b.flavor)
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!brand || b.brand_id === brand) &&
        ((!recommend && !status) ||
          ownPrefs.some(
            (p) =>
              p.bean_id === b.id &&
              (!recommend || p.recommendation === recommend) &&
              (!status || p.status === status),
          )),
    )
    .sort((a, b) => {
      if (
        coffeeSort === "price-asc" ||
        coffeeSort === "price-desc" ||
        coffeeSort === "kg"
      ) {
        const left =
          coffeeSort === "kg" ? kgPrice(a.price, a.weight_g) : a.price;
        const right =
          coffeeSort === "kg" ? kgPrice(b.price, b.weight_g) : b.price;
        if (left === null && right !== null) return 1;
        if (right === null && left !== null) return -1;
        if (left !== null && right !== null && left !== right)
          return (left - right) * (coffeeSort === "price-desc" ? -1 : 1);
      }
      if (coffeeSort === "brand")
        return (
          brandName(a).localeCompare(brandName(b), "ko") ||
          a.name.localeCompare(b.name, "ko")
        );
      return a.name.localeCompare(b.name, "ko");
    });
  function beanForm(bean?: Bean) {
    open({
      title: bean ? "원두 정보 수정" : "새로운 원두",
      operation: bean ? "coffee_update_bean" : "coffee_create_bean",
      extra: bean ? { id: bean.id, expected_version: bean.version } : {},
      description: "새로운 취향의 시작. 알고 있는 정보부터 채워보세요.",
      fields: [
        txt("name", "제품 이름", bean?.name, true),
        {
          name: "brand_id",
          label: "브랜드",
          type: "select",
          required: true,
          value: bean?.brand_id,
          options: data.brands.map((b) => ({ value: b.id, label: b.name })),
        },
        {
          name: "product_url",
          label: "상품 링크",
          type: "url",
          value: bean?.product_url,
        },
        number("price", "판매 가격 (원)", bean?.price),
        { ...number("weight_g", "포장 중량 (g)", bean?.weight_g), min: 1 },
        options("roast", "배전", ["약배전", "중배전", "강배전"], bean?.roast),
        area("flavor", "맛과 향", bean?.flavor),
      ],
      transform: (v) => ({
        ...v,
        roast: v.roast || null,
        image_url: bean?.image_url ?? null,
      }),
    });
  }
  function preferenceForm(bean: Bean) {
    const p = myPref(bean);
    open({
      title: "내 취향 기록",
      operation: "coffee_save_preference",
      extra: { bean_id: bean.id, expected_version: p?.version ?? null },
      description: bean.name,
      fields: [
        options("status", "경험", ["구매예정", "먹어봄"], p?.status),
        options(
          "recommendation",
          "내 추천",
          ["추천", "보통", "비추천"],
          p?.recommendation,
        ),
        area("note", "나의 평가", p?.note),
      ],
      transform: (v) => ({
        ...v,
        status: v.status || null,
        recommendation: v.recommendation || null,
      }),
    });
  }
  function brewForm(bean: Bean) {
    const b = myBrew(bean);
    open({
      title: "내 머신 세팅",
      description: "분쇄도와 용량은 머신에 표시되는 설정 숫자입니다.",
      operation: "coffee_log_brew_setting",
      extra: { bean_id: bean.id },
      fields: [
        {
          name: "machine_id",
          label: "머신",
          type: "select",
          required: true,
          value: b?.machine_id,
          options: data.machines.map((m) => ({ value: m.id, label: m.name })),
        },
        {
          ...number("grind", "분쇄도 설정", b?.grind),
          required: true,
          step: "any",
        },
        {
          ...number("dose", "용량 설정", b?.dose),
          required: true,
          step: "any",
        },
        area("note", "세팅 메모"),
      ],
    });
  }
  function wineForm(wine?: Wine) {
    open({
      title: wine ? "와인 정보 수정" : "셀러에 새로운 와인",
      description: "제품을 등록한 다음 구매 내역을 추가하면 재고에 반영됩니다.",
      operation: wine ? "wine_update" : "wine_create",
      extra: wine ? { id: wine.id, expected_version: wine.version } : {},
      fields: [
        txt("name", "한글 이름", wine?.name, true),
        txt("english_name", "영어 이름", wine?.english_name),
        txt("producer", "생산자", wine?.producer),
        options("type", "종류", wineTypes, wine?.type, true),
        txt("country", "나라", wine?.country),
        txt("region", "지역", wine?.region),
        txt("grapes", "품종", wine?.grapes),
        {
          name: "vintage_kind",
          label: "빈티지 구분",
          type: "select",
          required: true,
          value: wine?.vintage_kind ?? "unknown",
          options: [
            { value: "unknown", label: "아직 모름" },
            { value: "year", label: "연도 있음" },
            { value: "non_vintage", label: "NV (논 빈티지)" },
          ],
        },
        {
          ...number("vintage", "빈티지 연도", wine?.vintage),
          min: 1800,
          max: 2200,
        },
        { ...number("volume_ml", "병 용량 (ml)", wine?.volume_ml), min: 1 },
      ],
      transform: (v) => ({
        ...v,
        vintage: v.vintage_kind === "year" ? v.vintage : null,
      }),
    });
  }
  function receiveForm(wine: Wine) {
    open({
      title: "와인 입고",
      description: wine.name,
      operation: "wine_receive_stock",
      extra: { wine_id: wine.id },
      fields: [
        {
          ...number("quantity", "입고 수량 (병)", 1),
          required: true,
          min: 1,
          max: 1000,
        },
        number("unit_price", "병당 구매가 (원)"),
        {
          name: "purchased_on",
          label: "구매일",
          type: "date",
          required: true,
          value: today(),
        },
        txt("store", "구매처"),
      ],
    });
  }
  function tastingFields(): Field[] {
    return [
      {
        name: "tasted_on",
        label: "시음일",
        type: "date",
        required: true,
        value: today(),
      },
      { ...number("score", "점수 (0~100)"), max: 100 },
      {
        name: "repurchase",
        label: "재구매 의사",
        type: "select",
        options: [
          { value: "true", label: "다시 사고 싶어요" },
          { value: "false", label: "이번으로 충분해요" },
        ],
      },
      area("note", "시음 노트"),
    ];
  }
  function consumeForm(wine: Wine) {
    open({
      title: "오늘의 한 병",
      description: `${wine.name} · 현재 ${wine.stock}병`,
      operation: "wine_consume",
      extra: { wine_id: wine.id },
      fields: [
        {
          ...number("quantity", "소비 수량 (병)", 1),
          required: true,
          min: 1,
          max: wine.stock,
        },
        ...tastingFields(),
      ],
      transform: (v) => {
        const { score, note, repurchase, tasted_on, ...rest } = v;
        return {
          ...rest,
          occurred_on: tasted_on,
          ...(score !== null || note || repurchase
            ? {
                tasting: {
                  score,
                  note,
                  repurchase: repurchase === "" ? null : repurchase === "true",
                  tasted_on,
                },
              }
            : {}),
        };
      },
    });
  }
  function tastingForm(wine: Wine) {
    open({
      title: "시음 노트 남기기",
      description: "시음 기록만 추가하며 재고는 변경하지 않습니다.",
      operation: "wine_log_tasting",
      extra: { wine_id: wine.id },
      fields: tastingFields(),
      transform: (v) => ({
        ...v,
        repurchase: v.repurchase === "" ? null : v.repurchase === "true",
      }),
    });
  }
  function archiveForm(row: Bean | Wine, domain: "coffee" | "wine") {
    open({
      title: row.archived ? "보관 해제" : "목록에서 보관하기",
      description: row.name,
      operation: "archive_item",
      extra: {
        domain,
        id: row.id,
        expected_version: row.version,
        archived: !row.archived,
      },
      fields: [],
    });
  }
  function coffeeCard(bean: Bean) {
    const preferences = ownPrefs.filter((p) => p.bean_id === bean.id);
    const brew = myBrew(bean);
    const machine = data.machines.find((m) => m.id === brew?.machine_id);
    const unitPrice = kgPrice(bean.price, bean.weight_g);
    return (
      <article className="coffee-row" key={bean.id}>
        <div className="coffee-identity">
          <Link
            className="brand-label"
            href={href(`/coffee/brands?${coffeeQuery}#brand-${bean.brand_id}`)}
          >
            {brandName(bean)}
          </Link>
          <Link href={href(`/coffee/beans/${bean.id}?${coffeeQuery}`)}>
            <h3>{bean.name}</h3>
          </Link>
          <p className="coffee-flavor">{bean.flavor || "맛과 향 미입력"}</p>
          {bean.roast && <Tag>{bean.roast}</Tag>}
        </div>
        <div className="coffee-price">
          <span className="coffee-column-label">판매 가격</span>
          <strong>{money(bean.price)}</strong>
          <span>{bean.weight_g ? `${bean.weight_g}g` : "중량 미입력"}</span>
          <small>
            {unitPrice !== null
              ? `${money(unitPrice)} / kg`
              : "환산 가격 미계산"}
          </small>
        </div>
        <div className="coffee-preferences">
          <span className="coffee-column-label">
            {person === "all"
              ? "사용자 평가"
              : person === data.user.id
                ? "내 평가"
                : `${memberName(person)}의 평가`}
          </span>
          {preferences.length ? (
            preferences.map((p) => (
              <div key={p.id}>
                {person === "all" && <small>{memberName(p.user_id)}</small>}
                <div className="bean-tags">
                  {p.status && <Tag>{p.status}</Tag>}
                  {p.recommendation && (
                    <Tag
                      tone={
                        p.recommendation === "추천"
                          ? "green"
                          : p.recommendation === "비추천"
                            ? "rose"
                            : ""
                      }
                    >
                      {p.recommendation}
                    </Tag>
                  )}
                </div>
                {p.note && <p className="coffee-flavor">{p.note}</p>}
              </div>
            ))
          ) : (
            <span className="muted small">아직 평가 없음</span>
          )}
          <button
            className="coffee-text-button"
            onClick={() => preferenceForm(bean)}
            aria-label={`${bean.name} 내 평가`}
          >
            내 평가 기록
          </button>
        </div>
        <div className="coffee-brew">
          <span className="coffee-column-label">내 최근 머신 세팅</span>
          {brew && (
            <>
              <span>{machine?.name || "머신"}</span>
              <small>
                분쇄 {brew.grind ?? "—"} · 용량 {brew.dose ?? "—"}
              </small>
            </>
          )}
          <button
            className="setting-pill"
            onClick={() => brewForm(bean)}
            aria-label={`${bean.name} 머신 세팅`}
          >
            <SlidersHorizontal size={13} />
            {brew ? "세팅 기록" : "세팅 추가"}
          </button>
        </div>
      </article>
    );
  }
  function empty(
    title: string,
    desc: string,
    action?: () => void,
    label = "등록하기",
  ) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          {active === "/wine" ? <WineIcon size={30} /> : <Coffee size={30} />}
        </div>
        <h3>{title}</h3>
        <p>{desc}</p>
        {action && (
          <button className="button primary" onClick={action}>
            <Plus size={16} />
            {label}
          </button>
        )}
      </div>
    );
  }
  function pageHeading(
    eyebrow: string,
    title: string,
    description: string,
    action?: () => void,
    label = "새 기록",
  ) {
    return (
      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>
            {title}
            <span className="heading-dot">.</span>
          </h1>
          <p>{description}</p>
        </div>
        {action && (
          <button className="button primary add-button" onClick={action}>
            <Plus size={18} />
            <span>{label}</span>
          </button>
        )}
      </div>
    );
  }
  function tabs(domain: "coffee" | "wine") {
    return (
      <div className="section-tabs">
        <Link
          className={path === `/${domain}` ? "selected" : ""}
          href={href(domain === "coffee" ? coffeeListUrl : `/${domain}`)}
        >
          {domain === "coffee" ? "원두 컬렉션" : "나의 셀러"}{" "}
          <span>
            {domain === "coffee"
              ? data.beans.filter((b) => !b.archived).length
              : data.wines.filter((w) => !w.archived).length}
          </span>
        </Link>
        <Link
          className={
            path.endsWith(domain === "coffee" ? "brands" : "glasses")
              ? "selected"
              : ""
          }
          href={href(
            domain === "coffee"
              ? `/coffee/brands?${coffeeQuery}`
              : "/wine/glasses",
          )}
        >
          {domain === "coffee" ? "브랜드 스토어" : "와인잔"}
        </Link>
      </div>
    );
  }
  function renderHome() {
    return <WorkspaceHome data={data} href={href} />;
  }
  function renderCoffee() {
    return (
      <>
        {pageHeading(
          "THE COFFEE COLLECTION",
          "커피",
          "원두와 브랜드를 관리하고 평가와 추출 설정을 기록합니다.",
          () => beanForm(),
          "원두 등록",
        )}
        {tabs("coffee")}
        <div className="filter-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="원두 검색"
              placeholder="원두, 브랜드, 맛과 향 검색"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateFilter("q", e.target.value);
              }}
            />
          </label>
          <div className="filter-selects">
            <select
              aria-label="브랜드 필터"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                updateFilter("brand", e.target.value);
              }}
            >
              <option value="">모든 브랜드</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label="평가한 사용자"
              value={person}
              onChange={(e) => {
                setPerson(e.target.value);
                updateFilter("person", e.target.value);
              }}
            >
              <option value="all">사용자 전체</option>
              {data.members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === data.user.id ? "내 취향" : m.name}
                </option>
              ))}
            </select>
            <select
              aria-label="경험 필터"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateFilter("status", e.target.value);
              }}
            >
              <option value="">모든 경험</option>
              <option>구매예정</option>
              <option>먹어봄</option>
            </select>
          </div>
        </div>
        <div className="collection-controls">
          <div className="filter-chips">
            {["", "추천", "보통", "비추천"].map((r) => (
              <button
                key={r}
                className={recommend === r ? "active" : ""}
                onClick={() => {
                  setRecommend(r);
                  updateFilter("recommend", r);
                }}
              >
                {r === "추천" && <Heart size={13} />}
                {r || "전체 원두"}
              </button>
            ))}
          </div>
          <div className="view-controls">
            <label>
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  setArchived(e.target.checked);
                  updateFilter("archived", String(e.target.checked));
                }}
              />{" "}
              보관함
            </label>
            <span>{beans.length}개</span>
            <select
              aria-label="원두 정렬"
              value={coffeeSort}
              onChange={(e) => {
                setCoffeeSort(e.target.value);
                updateFilter("sort", e.target.value);
              }}
            >
              <option value="name">이름순</option>
              <option value="brand">브랜드순</option>
              <option value="price-asc">판매 가격 낮은순</option>
              <option value="price-desc">판매 가격 높은순</option>
              <option value="kg">1kg 가격 낮은순</option>
            </select>
            <button
              className="coffee-text-button"
              onClick={() => {
                setSearch("");
                setBrand("");
                setRecommend("");
                setStatus("");
                setPerson(data.user.id);
                setArchived(false);
                setCoffeeSort("name");
                for (const key of [
                  "q",
                  "brand",
                  "recommend",
                  "status",
                  "person",
                  "archived",
                  "sort",
                ])
                  updateFilter(key, "");
              }}
            >
              초기화
            </button>
          </div>
        </div>
        {beans.length ? (
          <div className="coffee-list">{beans.map(coffeeCard)}</div>
        ) : (
          empty(
            "원두를 찾지 못했어요",
            "검색어 또는 필터를 바꾸거나 새로운 원두를 기록해보세요.",
            () => beanForm(),
            "원두 등록",
          )
        )}
        <div className="collection-footnote">
          판매 가격은 한 포장 기준입니다. 중량을 입력하면 1kg 환산 가격으로
          비교할 수 있습니다. 가격 미입력 항목은 가격 정렬 시 마지막에
          표시합니다.
        </div>
      </>
    );
  }
  function renderBrands() {
    return (
      <>
        {pageHeading(
          "OUR FAVORITE ROASTERS",
          "브랜드 스토어",
          "좋은 원두를 만나는 곳들을 모았어요.",
          () =>
            open({
              title: "브랜드 등록",
              operation: "coffee_create_brand",
              fields: [
                txt("name", "브랜드 이름", "", true),
                { name: "url", label: "스토어 링크", type: "url" },
                area("description", "소개"),
              ],
            }),
          "브랜드 등록",
        )}
        {tabs("coffee")}
        <div className="brand-grid">
          {data.brands.map((b, i) => (
            <article className="brand-card" key={b.id} id={`brand-${b.id}`}>
              <div className={`brand-monogram tone-${i % 4}`}>
                {b.name.slice(0, 1)}
              </div>
              <div>
                <Link href={href(`/coffee?brand=${b.id}`)}>
                  <h3>{b.name}</h3>
                </Link>
                <Link
                  className="coffee-text-button"
                  href={href(`/coffee?brand=${b.id}`)}
                  aria-label={`${b.name} 원두 보기`}
                >
                  원두{" "}
                  {
                    data.beans.filter((x) => x.brand_id === b.id && !x.archived)
                      .length
                  }
                  개 보기 <ArrowRight size={13} />
                </Link>
              </div>
              <div className="brand-card-actions">
                {b.url && (
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${b.name} 스토어 열기`}
                  >
                    <ArrowUpRight size={20} />
                  </a>
                )}
                {editAllowed(b) && (
                  <button
                    className="icon-button"
                    aria-label={`${b.name} 수정`}
                    onClick={() =>
                      open({
                        title: "브랜드 수정",
                        operation: "coffee_update_brand",
                        extra: { id: b.id, expected_version: b.version },
                        fields: [
                          txt("name", "브랜드 이름", b.name, true),
                          {
                            name: "url",
                            label: "스토어 링크",
                            type: "url",
                            value: b.url,
                          },
                          area("description", "소개", b.description),
                        ],
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>
              {b.description && (
                <p className="brand-description">{b.description}</p>
              )}
            </article>
          ))}
        </div>
      </>
    );
  }
  function renderBean(bean: Bean) {
    const p = myPref(bean);
    return (
      <>
        <Link className="back-link" href={href(coffeeListUrl)}>
          <ChevronLeft size={16} />
          원두 컬렉션
        </Link>
        <div className="detail-top coffee-detail">
          <div className="detail-copy">
            <Link
              className="eyebrow"
              href={href(`/coffee?brand=${bean.brand_id}`)}
            >
              {brandName(bean)} · 원두 보기 <ArrowRight size={13} />
            </Link>
            <h1>{bean.name}</h1>
            <div className="bean-tags">
              {bean.roast && <Tag>{bean.roast}</Tag>}
              {p?.recommendation && <Tag tone="green">{p.recommendation}</Tag>}
              {bean.archived && <Tag>보관 중</Tag>}
            </div>
            <p>{bean.flavor || "이 원두의 맛과 향을 기록해보세요."}</p>
            <dl className="detail-facts">
              <div>
                <dt>판매 가격</dt>
                <dd>{money(bean.price)}</dd>
              </div>
              <div>
                <dt>판매 단위</dt>
                <dd>{bean.weight_g ? `${bean.weight_g}g` : "중량 미입력"}</dd>
              </div>
              <div>
                <dt>1kg 환산 가격</dt>
                <dd>
                  {kgPrice(bean.price, bean.weight_g) !== null
                    ? money(kgPrice(bean.price, bean.weight_g))
                    : "가격·중량 입력 후 계산"}
                </dd>
              </div>
            </dl>
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => preferenceForm(bean)}
              >
                <Heart size={16} />내 평가 남기기
              </button>
              {bean.product_url && (
                <a
                  className="button secondary"
                  href={bean.product_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  상품 보기 <ExternalLink size={14} />
                </a>
              )}
            </div>
            {editAllowed(bean) && (
              <div className="text-actions">
                <button onClick={() => beanForm(bean)}>
                  <Pencil size={13} />
                  정보 수정
                </button>
                <button onClick={() => archiveForm(bean, "coffee")}>
                  <Archive size={13} />
                  {bean.archived ? "보관 해제" : "보관하기"}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="detail-columns">
          <section className="panel">
            <div className="section-heading compact">
              <h2>사용자별 평가</h2>
              <Heart size={18} />
            </div>
            {data.preferences
              .filter((x) => x.bean_id === bean.id)
              .map((x) => (
                <div className="note-card" key={x.id}>
                  <div>
                    <strong>{memberName(x.user_id)}</strong>
                    {x.recommendation && (
                      <Tag tone="green">{x.recommendation}</Tag>
                    )}
                    {x.status && <Tag>{x.status}</Tag>}
                  </div>
                  <p>{x.note || "아직 메모가 없어요."}</p>
                </div>
              ))}
            {!data.preferences.some((x) => x.bean_id === bean.id) && (
              <p className="muted">첫 번째 평가를 남겨보세요.</p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading compact">
              <h2>머신 세팅 기록</h2>
              <button className="text-button" onClick={() => brewForm(bean)}>
                <Plus size={15} />
                추가
              </button>
            </div>
            {data.brews
              .filter((x) => x.bean_id === bean.id)
              .map((x) => (
                <div className="brew-row" key={x.id}>
                  <div>
                    <strong>{memberName(x.user_id)}</strong>
                    <p>
                      {data.machines.find((m) => m.id === x.machine_id)?.name}
                    </p>
                    <small>{x.note}</small>
                  </div>
                  <div className="brew-values">
                    <span>
                      <small>분쇄도</small>
                      {x.grind}
                    </span>
                    <span>
                      <small>용량</small>
                      {x.dose}
                    </span>
                  </div>
                </div>
              ))}
            {!data.brews.some((x) => x.bean_id === bean.id) && (
              <p className="muted">머신 설정 숫자를 기록해두세요.</p>
            )}
          </section>
        </div>
      </>
    );
  }
  function renderWine() {
    return (
      <>
        {pageHeading(
          "WINE CELLAR",
          "와인 셀러",
          "보유 와인, 구매 내역과 시음 기록을 관리합니다.",
          () => wineForm(),
          "와인 등록",
        )}
        {tabs("wine")}
        <WineCellar
          key={`${stockOnly}:${data.wines.length}`}
          data={data}
          initialQuery={{ ...initialQuery, stock: stockOnly ? "" : "all" }}
          href={href}
          receive={receiveForm}
          consume={consumeForm}
        />
      </>
    );
  }
  function renderWineDetail(wine: Wine) {
    const events = data.events.filter((e) => e.wine_id === wine.id);
    return (
      <>
        <Link className="back-link" href={href("/wine")}>
          <ChevronLeft size={16} />
          와인 셀러
        </Link>
        <div className="detail-top wine-detail">
          <ProductArt
            name={wine.name}
            kind="wine"
            large
            imageUrl={
              wine.has_photo
                ? `/api/wine/${wine.id}/photo?v=${wine.version}`
                : null
            }
          />
          <div className="detail-copy">
            <span className="eyebrow">
              CELLAR NO. {String(wine.display_id).padStart(3, "0")}
            </span>
            <h1>{wine.name}</h1>
            <p>{wine.english_name}</p>
            <div className="bean-tags">
              <Tag tone="rose">{wine.type}</Tag>
              <Tag>{vintageLabel(wine)}</Tag>
              {wine.country && <Tag>{wine.country}</Tag>}
            </div>
            <dl className="detail-facts">
              <div>
                <dt>병당 구입가</dt>
                <dd>
                  {wineFacts(wine, data).price === null
                    ? "미입력"
                    : money(wineFacts(wine, data).price)}
                </dd>
              </div>
              <div>
                <dt>최근 구입일</dt>
                <dd>{wineFacts(wine, data).purchased_on || "미입력"}</dd>
              </div>
              <div>
                <dt>현재 보유</dt>
                <dd>{wine.stock}병</dd>
              </div>
              <div>
                <dt>품종</dt>
                <dd>{wine.grapes || "미입력"}</dd>
              </div>
              <div>
                <dt>지역</dt>
                <dd>{wine.region || "미입력"}</dd>
              </div>
              <div>
                <dt>생산자</dt>
                <dd>{wine.producer || "미입력"}</dd>
              </div>
            </dl>
            <div className="button-row">
              <button
                className="button primary"
                disabled={wine.stock === 0}
                onClick={() => consumeForm(wine)}
              >
                <WineIcon size={16} />한 병 소비하기
              </button>
              <button
                className="button secondary"
                onClick={() => receiveForm(wine)}
              >
                <Plus size={16} />
                입고
              </button>
              <button
                className="button secondary"
                onClick={() => tastingForm(wine)}
              >
                시음 기록
              </button>
            </div>
            <div className="text-actions">
              {editAllowed(wine) && (
                <>
                  <button onClick={() => wineForm(wine)}>
                    <Pencil size={13} />
                    정보 수정
                  </button>
                  <button onClick={() => archiveForm(wine, "wine")}>
                    <Archive size={13} />
                    {wine.archived ? "보관 해제" : "보관하기"}
                  </button>
                </>
              )}
              <a
                href={`https://www.vivino.com/search/wines?q=${encodeURIComponent(`${wine.english_name || wine.name} ${wine.vintage ?? ""}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Vivino에서 찾기 <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
        {editAllowed(wine) && (
          <WinePhotoUpload wine={wine} onUpdated={reload} demo={demo} />
        )}
        <div className="detail-columns">
          <section className="panel">
            <div className="section-heading compact">
              <h2>구매와 소비의 기록</h2>
              <span className="muted small">{events.length}개</span>
            </div>
            {events.map((event) => {
              return (
                <div className="event-row" key={event.id}>
                  <span
                    className={`event-icon ${event.delta < 0 ? "out" : ""}`}
                  >
                    {event.delta > 0 ? (
                      <Plus size={16} />
                    ) : (
                      <ArrowDownLeft size={16} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {event.kind === "receive"
                        ? "입고"
                        : event.kind === "consume"
                          ? "소비"
                          : event.kind === "reverse"
                            ? "취소"
                            : "초기 재고"}
                    </strong>
                    <p>
                      {dateLabel(event.occurred_on)} ·{" "}
                      {memberName(event.created_by)}
                    </p>
                    {event.reason && <small>{event.reason}</small>}
                  </div>
                  <b>
                    {event.delta > 0 ? "+" : ""}
                    {event.delta}병
                  </b>
                  {editAllowed(event) &&
                    !["reverse", "opening_balance"].includes(event.kind) &&
                    !data.events.some((e) => e.reverses_id === event.id) && (
                      <button
                        className="icon-button"
                        aria-label="이 기록 취소"
                        onClick={() =>
                          open({
                            title: "기록 취소",
                            description:
                              "원본 이력은 보존하고 반대 방향의 재고 기록을 남깁니다.",
                            operation: "wine_reverse_event",
                            extra: { event_id: event.id },
                            fields: [txt("reason", "취소 사유", "", true)],
                          })
                        }
                      >
                        <Undo2 size={14} />
                      </button>
                    )}
                </div>
              );
            })}
            {!events.length && (
              <p className="muted">입고하면 재고가 기록됩니다.</p>
            )}
            {data.purchases.some((p) => p.wine_id === wine.id) && (
              <div className="purchase-history">
                <h3>구매 내역</h3>
                {data.purchases
                  .filter((p) => p.wine_id === wine.id)
                  .map((p) => (
                    <div key={p.id}>
                      <span>
                        {dateLabel(p.purchased_on)} · {p.quantity}병
                      </span>
                      <strong>{money(p.unit_price)} / 병</strong>
                    </div>
                  ))}
              </div>
            )}
          </section>
          <section className="panel">
            <div className="section-heading compact">
              <h2>사용자별 시음 노트</h2>
              <button className="text-button" onClick={() => tastingForm(wine)}>
                <Plus size={15} />
                추가
              </button>
            </div>
            {data.tastings
              .filter((t) => t.wine_id === wine.id)
              .map((t) => (
                <div className="note-card" key={t.id}>
                  <div>
                    <strong>{memberName(t.user_id)}</strong>
                    {t.score !== null && <Tag>{t.score} / 100</Tag>}
                    {t.repurchase !== null && (
                      <Tag tone={t.repurchase ? "green" : ""}>
                        {t.repurchase ? "재구매 희망" : "재구매 안 함"}
                      </Tag>
                    )}
                  </div>
                  <p>{t.note || "평점만 남긴 시음이에요."}</p>
                  <time>{dateLabel(t.tasted_on)}</time>
                </div>
              ))}
            {!data.tastings.some((t) => t.wine_id === wine.id) && (
              <div className="quiet-empty">
                <BookOpen size={25} />
                <p>첫 모금의 인상을 남겨보세요.</p>
              </div>
            )}
          </section>
        </div>
      </>
    );
  }
  function renderGlasses() {
    const add = () =>
      open({
        title: "와인잔 등록",
        operation: "wine_save_glass",
        fields: [
          txt("name", "잔 이름", "", true),
          txt("brand", "브랜드"),
          options("type", "잔 종류", glassTypes, undefined, true),
          area("note", "메모"),
        ],
      });
    return (
      <>
        {pageHeading(
          "THE FINISHING TOUCH",
          "와인잔",
          "와인의 순간을 더 좋게 만드는 작은 차이.",
          add,
          "와인잔 등록",
        )}
        {tabs("wine")}
        {data.glasses.length ? (
          <div className="brand-grid">
            {data.glasses.map((g) => (
              <article className="glass-card panel" key={g.id}>
                <GlassWater size={50} strokeWidth={1} />
                <span className="brand-label">{g.brand}</span>
                <h3>{g.name}</h3>
                <Tag>{g.type}</Tag>
                <p>{g.note}</p>
                {editAllowed(g) && (
                  <button
                    className="text-button"
                    onClick={() =>
                      open({
                        title: "와인잔 수정",
                        operation: "wine_save_glass",
                        extra: { id: g.id, expected_version: g.version },
                        fields: [
                          txt("name", "잔 이름", g.name, true),
                          txt("brand", "브랜드", g.brand),
                          options("type", "잔 종류", glassTypes, g.type, true),
                          area("note", "메모", g.note),
                        ],
                      })
                    }
                  >
                    수정 <Pencil size={13} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          empty(
            "와인잔도 함께 기록해요",
            "AI가 보유 중인 잔을 참고해 와인과 어울리는 잔을 제안할 수 있어요.",
            add,
            "와인잔 등록",
          )
        )}
      </>
    );
  }
  function renderSettings() {
    return (
      <>
        {pageHeading(
          "MAKE YOURSELF AT HOME",
          "설정",
          "계정, 구성원, 도구와 AI 연결을 관리합니다.",
        )}
        <div className="settings-grid">
          <section className="panel">
            <div className="section-heading compact">
              <h2>
                <Users size={19} /> 함께하는 가족
              </h2>
              {data.user.role === "owner" && (
                <button
                  className="text-button"
                  onClick={() =>
                    open({
                      title: "가족 초대",
                      description:
                        "허용한 이메일의 Google 계정으로 로그인할 수 있어요. 초대 메일은 발송하지 않습니다.",
                      operation: "family_invite",
                      fields: [
                        {
                          name: "email",
                          label: "가족 이메일",
                          type: "email",
                          required: true,
                        },
                      ],
                      extra: { role: "member" },
                    })
                  }
                >
                  <Plus size={15} />
                  초대
                </button>
              )}
            </div>
            {data.members
              .filter((m) => m.active)
              .map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span className="avatar">{m.name[0]}</span>
                  <div>
                    <strong>
                      {m.name}
                      {m.user_id === data.user.id ? " (나)" : ""}
                    </strong>
                    <p>{m.role === "owner" ? "관리자" : "구성원"}</p>
                  </div>
                  {data.user.role === "owner" && m.role !== "owner" && (
                    <button
                      className="text-button danger"
                      onClick={() =>
                        open({
                          title: "가족 접근 해제",
                          description: `${m.name}님의 로그인과 AI 접근을 차단합니다. 기존 기록은 보존합니다.`,
                          operation: "family_remove",
                          extra: { user_id: m.user_id },
                          fields: [],
                        })
                      }
                    >
                      접근 해제
                    </button>
                  )}
                </div>
              ))}
            {data.invites
              .filter((i) => i.active)
              .map((i) => (
                <div className="invite-row" key={i.id}>
                  <span>
                    {i.email}
                    <small>로그인 허용 이메일</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`${i.email} 초대 취소`}
                    onClick={() =>
                      open({
                        title: "초대 취소",
                        description:
                          "이미 가입한 가족은 위의 접근 해제를 사용해주세요.",
                        operation: "family_cancel_invite",
                        extra: { id: i.id },
                        fields: [],
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
          </section>
          <section className="panel">
            <div className="section-heading compact">
              <h2>
                <Coffee size={19} /> 커피 머신
              </h2>
              <button
                className="text-button"
                onClick={() =>
                  open({
                    title: "머신 등록",
                    description:
                      "분쇄도·용량은 이 머신의 설정 숫자로 기록합니다.",
                    operation: "coffee_create_machine",
                    fields: [txt("name", "머신 이름", "", true)],
                  })
                }
              >
                <Plus size={15} />
                추가
              </button>
            </div>
            {data.machines.map((m) => (
              <div className="machine-row" key={m.id}>
                <SlidersHorizontal size={20} />
                <strong>{m.name}</strong>
              </div>
            ))}
            {!data.machines.length && (
              <p className="muted">세팅을 기록할 머신을 등록해주세요.</p>
            )}
          </section>
        </div>
        <ConnectionSettings demo={demo} />
        {!demo && (
          <button
            className="button secondary settings-signout"
            onClick={async () => {
              const response = await fetch("/api/auth/sign-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              if (response.ok) window.location.assign("/login");
              else inform("로그아웃하지 못했습니다. 다시 시도해주세요.");
            }}
          >
            <LogOut size={16} />
            로그아웃
          </button>
        )}
      </>
    );
  }
  const selectedBean = path.startsWith("/coffee/beans/")
    ? data.beans.find((b) => b.id === path.split("/")[3])
    : undefined;
  const selectedWine =
    path.startsWith("/wine/") && !path.endsWith("glasses")
      ? data.wines.find((w) => w.id === path.split("/")[2])
      : undefined;
  let content: React.ReactNode;
  if (path === "/") content = renderHome();
  else if (path === "/coffee") content = renderCoffee();
  else if (path === "/coffee/brands") content = renderBrands();
  else if (selectedBean) content = renderBean(selectedBean);
  else if (path === "/wine") content = renderWine();
  else if (path === "/wine/glasses") content = renderGlasses();
  else if (selectedWine) content = renderWineDetail(selectedWine);
  else if (path === "/cash/old") content = <CashOld demo={demo} />;
  else if (path === "/cash")
    content = <CashDashboard initialQuery={initialQuery} demo={demo} />;
  else if (path === "/etc/html") content = <HtmlPageList href={href} />;
  else if (path.startsWith("/etc/html/")) {
    const page = findHtmlPage(path.split("/")[3] ?? "");
    content = page ? <HtmlPageView page={page} href={href} demo={demo} /> : null;
  }
  else if (path === "/settings") content = renderSettings();
  else
    content = empty(
      "기록을 찾을 수 없어요",
      "목록에서 다른 기록을 선택해주세요.",
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={href("/")}>
          <span className="brand-mark">M</span>
          <div>
            MONO<small>PERSONAL WORKSPACE</small>
          </div>
        </Link>
        <div className="sidebar-family">
          <span className="family-house">
            <Home size={16} />
          </span>
          <div>
            <strong>Workspace</strong>
            <small>PERSONAL WORKSPACE</small>
          </div>
          <span className="family-dot" />
        </div>
        <span className="nav-caption">MY SPACE</span>
        <nav aria-label="PC 주 메뉴">
          {nav.map((n) => (
            <Link
              key={n.href}
              className={active === n.href ? "active" : ""}
              href={href(n.href)}
            >
              <n.icon size={19} />
              {n.label}
              {n.href === "/coffee" && (
                <span>{data.beans.filter((b) => !b.archived).length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>
              Your space,
              <br />
              your way.
            </span>
            <small>필요한 것을 하나의 공간에.</small>
          </div>
          <div className="profile">
            <span className="avatar">{data.user.name[0]}</span>
            <div>
              <strong>{data.user.name}</strong>
              <small>
                {demo
                  ? "둘러보기"
                  : data.user.role === "owner"
                    ? "관리자"
                    : "구성원"}
              </small>
            </div>
            {!demo && (
              <button
                className="icon-button"
                aria-label="로그아웃"
                onClick={async () => {
                  await fetch("/api/auth/sign-out", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  window.location.assign("/login");
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <span>MONO</span>
            {active !== "/" && (
              <>
                <span>/</span>
                <strong>{nav.find((n) => n.href === active)?.label}</strong>
              </>
            )}
          </div>
          <Link className="mobile-brand" href={href("/")}>
            <span className="brand-mark">M</span>
            <strong>MONO</strong>
          </Link>
          <div className="topbar-actions">
            <span className="private-indicator">
              <span />
              PRIVATE
            </span>
            <button
              className="icon-button"
              aria-label="새로고침"
              onClick={reload}
            >
              <RefreshCw size={17} className={refreshing ? "spin" : ""} />
            </button>
            <span className="avatar small-avatar">{data.user.name[0]}</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            문서의 초기 원두 목록으로 둘러보는 화면입니다.{" "}
            <Link href="/login">
              로그인 <ArrowRight size={13} />
            </Link>
          </div>
        )}
        <main className="main-content" id="main-content">
          {content}
          <footer className="page-footer">
            <span>MONO</span>
            <span>Built for your everyday.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {nav.filter((n) => n.href !== "/etc/html").map((n) => (
          <Link
            className={active === n.href ? "active" : ""}
            key={n.href}
            href={href(n.href)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
            {active === n.href && <i />}
          </Link>
        ))}
      </nav>
      {form && (
        <RecordForm spec={form} onClose={() => setForm(null)} onSave={save} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
