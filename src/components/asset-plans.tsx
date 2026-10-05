"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ASSET_PLAN_MAX_MONTHS,
  assetPlanKinds,
  digitsOnly,
  fixedAssetPlans,
  groupDigits,
  isaAmount,
  itemAmount,
  monthlyAmount,
  type AssetPlanItem,
  type AssetPlanKind,
  type AssetPlansView,
} from "@/lib/asset-plans";
import {
  assetMoney,
  assetSignedMoney,
  naverStockSearchUrl,
} from "@/lib/assets";
import type { Operation } from "@/lib/contracts";
import { demoAssetPlans } from "@/lib/demo-assets";
import { AssetPlanEditor } from "./asset-plan-editor";

// 분할매수 전략. 구성원마다 연금저축·IRP(고정)와 월급·현금 두 그룹의 종목 비중을 본다.
export function AssetPlans({
  initialQuery,
  demo = false,
  href = (p: string) => p,
}: {
  initialQuery: Record<string, string>;
  demo?: boolean;
  href?: (path: string) => string;
}) {
  const [owner, setOwner] = useState(
    () =>
      new URLSearchParams(
        initialQuery.assetQuery ?? new URLSearchParams(initialQuery).toString(),
      ).get("owner") ?? "",
  );
  const [data, setData] = useState<AssetPlansView | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<AssetPlanKind | null>(null);
  const [toast, setToast] = useState("");
  // 금액·기간 바꿔 보기. 저장하지 않고 화면의 계산만 바꾼다. 바꾼 값만 담고 나머지는 저장된 값을 쓴다.
  const [simOpen, setSimOpen] = useState(false);
  const [sim, setSim] = useState<Partial<Record<SimKey, number>>>({});
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        let body: AssetPlansView;
        if (demo) body = demoAssetPlans();
        else {
          const r = await fetch("/api/assets?view=plans", {
            cache: "no-store",
          });
          const parsed = await r.json();
          if (!r.ok)
            throw Error(parsed.error?.message ?? "불러오지 못했습니다.");
          body = parsed as AssetPlansView;
        }
        if (!live) return;
        setData(body);
        setError("");
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [revision, demo]);
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 5000);
  };
  function pickOwner(id: string) {
    setOwner(id);
    // 바꿔 본 값은 그 사람의 저장된 전략에서 출발한 것이라 사람을 바꾸면 버린다.
    setSim({});
    const url = new URL(window.location.href);
    url.searchParams.set("owner", id);
    window.history.replaceState(null, "", url);
  }
  async function save(operation: Operation, input: Record<string, unknown>) {
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, input }),
    });
    const body = await r.json();
    if (!r.ok) {
      // 버전 충돌이면 화면이 낡은 것이다. 창은 그대로 두고 뒤에서 최신 값을 다시 받는다.
      if (r.status === 409) setRevision((n) => n + 1);
      throw Error(body.error?.message ?? "저장하지 못했습니다.");
    }
    setRevision((n) => n + 1);
    inform("분할매수 전략을 저장했습니다.");
  }
  const openEditor = (kind: AssetPlanKind) => {
    if (demo) {
      inform("둘러보기 화면입니다. 로그인하면 전략을 저장할 수 있어요.");
      return;
    }
    setEditing(kind);
  };
  // 종목 이름은 네이버 증권을 새 창으로 연다. 코드를 알면 코드로 찾는 편이 정확하다.
  const stockHref = (item: AssetPlanItem) =>
    demo
      ? naverStockSearchUrl(item.name)
      : `/api/assets/stock?${new URLSearchParams({ name: item.code || item.name })}`;
  // 머리말은 어두운 배너다. 불러오는 중·오류 화면에서도 같은 자리에 같은 모양으로 둔다.
  const heroTop = (side?: React.ReactNode) => (
    <div className="plan-hero-top">
      <div>
        <span className="plan-tag">ASSETS / STRATEGY</span>
        <h1>분할매수 전략</h1>
      </div>
      <div className="plan-hero-actions">
        {side}
        <Link
          className="plan-hero-link"
          href={href("/assets/status")}
          aria-label="자산현황"
          title="자산현황"
        >
          자산현황
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
  const heading = <section className="plan-hero">{heroTop()}</section>;
  const toastBox = toast && (
    <div className="toast" role="status">
      {toast}
    </div>
  );
  if (error)
    return (
      <div className="asset-page">
        {heading}
        <div className="panel asset-error">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={15} /> 다시 시도
          </button>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="asset-page">
        {heading}
        <p className="muted">불러오는 중입니다…</p>
      </div>
    );
  if (!data.owners.length)
    return (
      <div className="asset-page">
        {heading}
        <div className="empty-state">
          <div className="empty-icon">
            <Plus size={30} />
          </div>
          <h3>자산 소유자가 없습니다</h3>
          <p>
            분할매수 전략은 자산현황의 구성원별로 정합니다. 자산현황에서
            소유자를 먼저 추가해주세요.
          </p>
          <Link className="button primary" href={href("/assets/status")}>
            자산현황으로
          </Link>
        </div>
      </div>
    );
  const current = data.owners.find((o) => o.id === owner) ?? data.owners[0];
  const planOf = (kind: AssetPlanKind) =>
    data.plans.find((p) => p.owner_id === current.id && p.kind === kind) ??
    null;
  const salary = planOf("salary");
  const cash = planOf("cash");
  const saved: Record<SimKey, number> = {
    pension: fixedAssetPlans.find((p) => p.key === "pension")?.amount ?? 0,
    irp: fixedAssetPlans.find((p) => p.key === "irp")?.amount ?? 0,
    salary: salary?.amount ?? 0,
    cash: cash?.amount ?? 0,
    months: cash?.months ?? 12,
  };
  const v = { ...saved, ...sim };
  const outcome = (x: Record<SimKey, number>) => {
    const cashMonthly = monthlyAmount({
      kind: "cash",
      amount: x.cash,
      months: x.months,
    });
    const monthly = x.pension + x.irp + x.salary + cashMonthly;
    return {
      cashMonthly,
      monthly,
      // 현금 분할매수는 정한 개월이 지나면 끝나므로 12개월 누적에는 그 개월만큼만 들어간다.
      year:
        (x.pension + x.irp + x.salary) * 12 +
        cashMonthly * Math.min(12, x.months),
      isa:
        isaAmount(x.salary, salary?.items ?? []) +
        isaAmount(cashMonthly, cash?.items ?? []),
    };
  };
  const now = outcome(v);
  const before = outcome(saved);
  const changed = (Object.keys(sim) as SimKey[]).some(
    (k) => sim[k] !== saved[k],
  );
  const fixedPlans = fixedAssetPlans.map((p) => ({
    ...p,
    amount: p.key === "pension" || p.key === "irp" ? v[p.key] : p.amount,
  }));
  const diff = (a: number, b: number) =>
    changed && a !== b ? (
      <em className={a > b ? "up" : "down"}>{assetSignedMoney(a - b)}</em>
    ) : null;
  const editingPlan = editing ? planOf(editing) : null;
  const parts = [
    ...fixedPlans.map((p) => ({
      key: p.key,
      label: p.title,
      amount: p.amount,
    })),
    { key: "salary", label: "월급", amount: v.salary },
    {
      key: "cash",
      label: v.cash ? `현금 · ${v.months}개월` : "현금",
      amount: now.cashMonthly,
    },
  ];
  const closeSim = () => {
    setSimOpen(false);
    setSim({});
  };
  return (
    <div className="asset-page plan-page">
      <section className={`plan-hero${changed ? " simulated" : ""}`}>
        {heroTop(
          <div className="plan-seg" role="group" aria-label="구성원">
            {data.owners.map((o) => (
              <button
                key={o.id}
                className={o.id === current.id ? "on" : ""}
                aria-pressed={o.id === current.id}
                onClick={() => pickOwner(o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>,
        )}
        <div className="plan-hero-main">
          <div>
            <span className="plan-hero-label">
              {current.name} · 한 달 매수 합계
              {changed && <b className="plan-sim-badge">바꿔 보는 중</b>}
            </span>
            <strong className="plan-total">
              {groupDigits(String(now.monthly))}
              <small>원</small>
            </strong>
            {diff(now.monthly, before.monthly)}
          </div>
          <div className="plan-year">
            <b>{assetMoney(now.year)}</b>
            <span>12개월 누적 {diff(now.year, before.year)}</span>
          </div>
        </div>
        {now.monthly > 0 && (
          <div className="plan-stack" aria-hidden="true">
            {parts
              .filter((p) => p.amount > 0)
              .map((p) => (
                <i
                  key={p.key}
                  className={`plan-c-${p.key}`}
                  style={{ flexGrow: p.amount }}
                />
              ))}
          </div>
        )}
        <ul className="plan-legend">
          {parts.map((p) => (
            <li key={p.key} className={`plan-c-${p.key}`}>
              <span>{p.label}</span>
              <b>{p.amount ? groupDigits(String(p.amount)) : "—"}</b>
            </li>
          ))}
          {now.isa > 0 && (
            <li className="plan-c-isa plan-legend-isa">
              <span>그중 ISA</span>
              <b>{groupDigits(String(now.isa))}</b>
            </li>
          )}
        </ul>
        <button
          className={`plan-sim-toggle${simOpen ? " on" : ""}`}
          aria-expanded={simOpen}
          onClick={() => (simOpen ? closeSim() : setSimOpen(true))}
        >
          <SlidersHorizontal size={16} />
          {simOpen ? "바꿔 보기 닫기" : "금액·기간 바꿔 보기"}
        </button>
      </section>
      {simOpen && (
        <section className="plan-sim" aria-label="금액·기간 바꿔 보기">
          <header>
            <h2>금액·기간 바꿔 보기</h2>
            <span>저장되지 않습니다</span>
            <button
              className="icon-button"
              aria-label="원래 값으로"
              title="원래 값으로"
              disabled={!changed}
              onClick={() => setSim({})}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="닫기"
              onClick={closeSim}
            >
              <X size={16} />
            </button>
          </header>
          <div className="plan-sim-grid">
            {simFields.map((f) => (
              <SimField
                key={f.key}
                label={f.label}
                unit={f.unit}
                value={v[f.key]}
                saved={saved[f.key]}
                min={f.unit === "개월" ? 1 : 0}
                max={f.max(saved[f.key])}
                step={f.step}
                onChange={(n) => setSim((s) => ({ ...s, [f.key]: n }))}
              />
            ))}
          </div>
        </section>
      )}
      <div className="plan-grid">
        {assetPlanKinds.map((kind) => {
          const plan = kind.key === "salary" ? salary : cash;
          const shown = {
            kind: kind.key,
            amount: kind.key === "salary" ? v.salary : v.cash,
            months: kind.key === "cash" ? v.months : null,
          };
          return (
            <PlanCard
              key={kind.key}
              group={kind.key}
              label={`${kind.title} · ${kind.key === "salary" ? "매달" : `${v.months}개월`}`}
              amount={monthlyAmount(shown)}
              meta={
                kind.key === "cash" && shown.amount
                  ? `총 ${assetMoney(shown.amount)}`
                  : ""
              }
              total={kind.key === "cash" ? v.cash : null}
              items={plan?.items ?? []}
              stockHref={stockHref}
              empty={
                plan
                  ? "종목이 없습니다. 수정에서 종목과 비중을 넣어주세요."
                  : `아직 정한 전략이 없습니다. ${kind.description}`
              }
              action={
                plan && !plan.editable ? (
                  <span
                    className="plan-readonly"
                    title="처음 저장한 사람 또는 관리자만 수정할 수 있습니다"
                  >
                    보기 전용
                  </span>
                ) : (
                  <button
                    className="plan-edit"
                    onClick={() => openEditor(kind.key)}
                  >
                    {plan ? <Pencil size={14} /> : <Plus size={14} />}
                    {plan ? "수정" : "전략 만들기"}
                  </button>
                )
              }
            />
          );
        })}
        {fixedPlans.map((p) => (
          <PlanCard
            key={p.key}
            group={p.key}
            label={`${p.title} · 고정`}
            amount={p.amount}
            meta="모든 구성원 공통"
            total={null}
            items={p.items}
            stockHref={stockHref}
            empty=""
          />
        ))}
      </div>
      {editing && (
        <AssetPlanEditor
          kind={editing}
          ownerId={current.id}
          ownerName={current.name}
          plan={editingPlan}
          holdings={data.holdings}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {toastBox}
    </div>
  );
}

type SimKey = "pension" | "irp" | "salary" | "cash" | "months";
// 바꿔 보기 칸. 막대의 끝은 저장된 값의 몇 배로 잡고, 그보다 큰 값은 숫자 칸에 직접 적는다.
const simFields: {
  key: SimKey;
  label: string;
  unit: "원" | "개월";
  step: number;
  max: (saved: number) => number;
}[] = [
  {
    key: "salary",
    label: "월급 분할매수 (월)",
    unit: "원",
    step: 10000,
    max: (n) => Math.max(n * 3, 5000000),
  },
  {
    key: "cash",
    label: "현금 분할매수 총액",
    unit: "원",
    step: 1000000,
    max: (n) => Math.max(n * 3, 100000000),
  },
  {
    key: "months",
    label: "현금 나눌 개월",
    unit: "개월",
    step: 1,
    max: () => ASSET_PLAN_MAX_MONTHS,
  },
  {
    key: "pension",
    label: "연금저축 (월)",
    unit: "원",
    step: 10000,
    max: (n) => Math.max(n * 3, 1500000),
  },
  {
    key: "irp",
    label: "IRP (월)",
    unit: "원",
    step: 10000,
    max: (n) => Math.max(n * 3, 1000000),
  },
];

function SimField({
  label,
  unit,
  value,
  saved,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: "원" | "개월";
  value: number;
  saved: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const limit = unit === "개월" ? ASSET_PLAN_MAX_MONTHS : 1000000000000;
  const set = (n: number) => onChange(Math.min(limit, Math.max(min, n)));
  return (
    <label className={`plan-sim-field${value !== saved ? " changed" : ""}`}>
      <span className="plan-sim-label">{label}</span>
      <span className="plan-sim-value">
        <input
          inputMode="numeric"
          value={unit === "원" ? groupDigits(String(value)) : String(value)}
          onChange={(e) => set(Number(digitsOnly(e.target.value) || 0))}
        />
        <em>{unit}</em>
      </span>
      <input
        type="range"
        min={min}
        max={Math.max(max, value)}
        step={step}
        value={value}
        aria-label={`${label} 조절`}
        onChange={(e) => set(Number(e.target.value))}
      />
      <small>
        {value !== saved
          ? `원래 ${unit === "원" ? assetMoney(saved) : `${saved}개월`}`
          : "\u00a0"}
      </small>
    </label>
  );
}

function PlanCard({
  group,
  label,
  amount,
  meta,
  total,
  items,
  stockHref,
  empty,
  action,
}: {
  // 색을 정하는 그룹 key(pension·irp·salary·cash).
  group: string;
  label: string;
  // 한 달에 사는 금액. 종목별 금액은 이 값에 비중을 곱한다.
  amount: number;
  meta: string;
  // 현금 분할매수의 총액. 종목별 총 매수액을 함께 적는다.
  total: number | null;
  items: AssetPlanItem[];
  stockHref: (item: AssetPlanItem) => string;
  empty: string;
  action?: React.ReactNode;
}) {
  const isa = amount > 0 ? isaAmount(amount, items) : 0;
  return (
    <article className={`plan-card plan-c-${group}`}>
      <header>
        <div>
          <span className="plan-kind">{label}</span>
          <strong className="plan-amount">
            {amount ? assetMoney(amount) : "—"}
            {amount > 0 && <small>/월</small>}
          </strong>
          {(meta || isa > 0) && (
            <span className="plan-meta">
              {meta}
              {meta && isa > 0 ? " · " : ""}
              {isa > 0 && (
                <>
                  ISA <b>{assetMoney(isa)}</b>
                </>
              )}
            </span>
          )}
        </div>
        {action}
      </header>
      {items.length > 0 && (
        <div className="plan-mini" aria-hidden="true">
          {items.map((item, i) => (
            <i
              key={i}
              className={item.isa ? "isa" : ""}
              style={{
                flexGrow: item.weight,
                opacity: item.isa ? 1 : 1 - i * 0.14,
              }}
            />
          ))}
        </div>
      )}
      {items.length ? (
        <ul className="plan-tiles">
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className={item.isa ? "isa" : ""}>
              <span className="plan-pct">{item.weight}%</span>
              <a
                className="plan-name"
                href={stockHref(item)}
                target="_blank"
                rel="noopener noreferrer"
                title="네이버 증권에서 보기"
              >
                <span>{item.name}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
              <span className="plan-code">
                {item.isa && <b className="plan-isa">ISA</b>}
                {/* 티커가 곧 이름이면(VOO) 같은 글자를 두 번 적지 않는다. */}
                {[item.code !== item.name && item.code, item.market]
                  .filter(Boolean)
                  .join(" · ") || (item.code ? "\u00a0" : "코드 없음")}
              </span>
              <strong className="plan-item-amount">
                {amount > 0 ? assetMoney(itemAmount(amount, item.weight)) : "—"}
              </strong>
              {total !== null && total > 0 && (
                <span className="plan-item-total">
                  총 {assetMoney(itemAmount(total, item.weight))}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="plan-empty">{empty}</p>
      )}
    </article>
  );
}
