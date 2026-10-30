"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  TriangleAlert,
  ArrowUpRight,
  CalendarRange,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  History,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  ASSET_HIDDEN,
  assetAxes,
  assetGroups,
  assetChangeRate,
  assetChangeText,
  assetChangeTone,
  assetCompact,
  assetMoney,
  assetPct,
  assetSignedMoney,
  assetSignedPct,
  assetRanges,
  assetStatusText,
  assetStockBoardDefs,
  assetStockProfitTotal,
  findAssetGroup,
  naverStockSearchUrl,
  periodLabel,
  type AssetAxis,
  type AssetPeriod,
  type AssetRange,
  type AssetRisk,
  type AssetStockBoard,
  type AssetStockProfit,
  type AssetSummary,
} from "@/lib/assets";
import type { AssetOverview } from "@/server/assets";
import { AssetPie, AssetTreemap, assetColor } from "./asset-chart";
import { AssetTrendView } from "./asset-trend-view";
import { AssetDetail, type AssetDetailTarget } from "./asset-detail";
import { AssetUpload } from "./asset-upload";
import { RecordForm, type FormSpec } from "./record-form";
import type { Operation } from "@/lib/contracts";
import { demoAssetOverview, demoAssetItems } from "@/lib/demo-assets";
import { copyTextLater } from "@/lib/clipboard";

const periods: { key: AssetPeriod; label: string }[] = [
  { key: "month", label: "월별" },
  { key: "year", label: "연별" },
];
const chartAxes = assetAxes.filter(
  (a) => a.key === "group" || a.key === "parent",
);
// 금액 가리기는 화면을 남에게 보일 때 켠다. 새로고침이나 다음 방문에 금액이 다시 드러나지 않도록
// 이 브라우저에 기억한다. 서버 렌더에서는 늘 꺼진 값이지만 그때는 불러오는 중 화면이라 결과가 같다.
const HIDE_KEY = "mono.assets.hide-amounts";
function readHideAmounts() {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(HIDE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

// 자산현황(status)과 자산추이(trend)는 같은 조회·필터·머리말을 쓰는 두 화면이다.
// 현황은 최신 기간 하나의 구성을, 추이는 표시 범위 안의 흐름과 직전 기간 대비 증감을 본다.
export type AssetView = "status" | "trend";
const views: { key: AssetView; path: string; label: string }[] = [
  { key: "status", path: "/assets/status", label: "현황" },
  { key: "trend", path: "/assets/trend", label: "추이" },
];
export function AssetStatus({
  initialQuery,
  view = "status",
  demo = false,
  href = (p: string) => p,
}: {
  initialQuery: Record<string, string>;
  view?: AssetView;
  demo?: boolean;
  href?: (path: string) => string;
}) {
  const [query, setQuery] = useState(
    () =>
      initialQuery.assetQuery ?? new URLSearchParams(initialQuery).toString(),
  );
  const [data, setData] = useState<AssetOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<AssetDetailTarget | null>(null);
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [hide, setHide] = useState(readHideAmounts);
  const toggleHide = (next: boolean) => {
    setHide(next);
    try {
      window.localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // 저장소를 못 쓰는 창에서도 지금 화면의 가리기는 그대로 동작한다.
    }
  };
  const trend = view === "trend";
  const params = new URLSearchParams(query);
  const owner = params.get("owner") || "all";
  // 현황은 최신 기간의 직전 달과 비교한다. 추이 화면에서 고른 연별·범위는 현황에 쓰지 않는다.
  const period: AssetPeriod = trend
    ? (params.get("period") as AssetPeriod) || "month"
    : "month";
  const axis = (params.get("axis") as AssetAxis) || "group";
  const range = (params.get("range") as AssetRange) || "1y";
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setQuery(next.toString());
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      // 둘러보기는 view가 화면 경로라 남긴다.
      const demoView = url.searchParams.get("view");
      url.search = next.toString();
      if (demo && demoView) url.searchParams.set("view", demoView);
      window.history.replaceState(null, "", url);
    }
  }
  // 서버에 보낼 조회 조건. 현황은 월별·최근 1년으로 고정한다.
  const fetchQuery = (q: URLSearchParams) => {
    if (!trend) {
      q.delete("period");
      q.set("range", "1y");
    } else if (!q.get("range")) q.set("range", "1y");
    return q;
  };
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        let body: AssetOverview;
        const q = fetchQuery(new URLSearchParams(query));
        if (demo) body = demoAssetOverview(q);
        else {
          const r = await fetch(`/api/assets?${q}`, { cache: "no-store" });
          const parsed = await r.json();
          if (!r.ok)
            throw Error(parsed.error?.message ?? "불러오지 못했습니다.");
          body = parsed as AssetOverview;
        }
        if (!live) return;
        setData(body);
        setError("");
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
    // fetchQuery는 view에만 기대므로 view로 대신한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, revision, demo, view]);
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 5000);
  };
  async function save(operation: Operation, input: Record<string, unknown>) {
    if (demo)
      throw Error(
        "둘러보기 화면에서는 저장하지 않습니다. 로그인 후 이용해주세요.",
      );
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, input }),
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.error?.message ?? "저장하지 못했습니다.");
    setRevision((n) => n + 1);
    inform("자산 기록을 저장했습니다.");
  }
  const open = (spec: FormSpec) => {
    if (demo) {
      inform("둘러보기 화면입니다. 로그인하면 기록을 저장할 수 있어요.");
      return;
    }
    setForm(spec);
  };
  const ownerForm = () =>
    open({
      title: "자산 소유자 추가",
      description:
        "자산현황에 표시할 이름입니다. 로그인 계정이 없는 구성원도 등록할 수 있습니다.",
      operation: "asset_save_owner",
      fields: [{ name: "name", label: "이름", required: true }],
    });
  // 자산 목록은 수십 줄이라 화면에서 한 칸씩 넣을 것이 아니다. CSV 한 장을 올린다.
  // 둘러보기에서도 창은 연다. CSV 규격을 보여주는 것이 이 화면의 설명이고,
  // 저장은 save()가 막으므로 창 안에서 그 이유를 읽는 편이 낫다.
  const openUpload = () => setUpload(true);
  const activeOwners = data?.owners.filter((o) => o.active) ?? [];
  // 현재 자산을 글로 복사한다. 화면의 구성원 필터와 무관하게 늘 전체 구성원 합계의 최신 기간이다.
  // 종합을 보고 있으면 받은 값을 그대로 쓰고, 한 사람을 보고 있으면 종합을 한 번 더 받는다.
  async function loadAll(): Promise<AssetOverview> {
    if (data && owner === "all") return data;
    const q = fetchQuery(new URLSearchParams(query));
    q.delete("owner");
    if (demo) return demoAssetOverview(q);
    const r = await fetch(`/api/assets?${q}`, { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
    return body as AssetOverview;
  }
  async function copyAssets() {
    const text = loadAll().then((all) => {
      if (!all.summaries.group) throw Error("복사할 자산 기록이 없습니다.");
      return assetStatusText({
        summary: all.summaries.group,
        stocks: all.stocks,
        owners: all.ownerTotals,
        hide,
      });
    });
    try {
      await copyTextLater(text);
      inform(
        hide
          ? "현재 자산을 금액 없이 복사했습니다."
          : "현재 자산을 클립보드에 복사했습니다.",
      );
    } catch (e) {
      inform((e as Error).message || "복사하지 못했습니다.");
    }
  }
  // 머리말 버튼은 오류·로딩 화면에도 그대로 나온다. 그 화면에서 눌러도 창이 떠야 하므로
  // 모달과 토스트는 모든 반환 경로에 함께 붙인다.
  const overlays = (
    <>
      {detail && (
        <AssetDetail
          target={detail}
          owner={owner}
          period={period}
          demo={demo}
          demoItems={demoAssetItems}
          hide={hide}
          onClose={() => setDetail(null)}
        />
      )}
      {form && (
        <RecordForm spec={form} onClose={() => setForm(null)} onSave={save} />
      )}
      {upload && (
        <AssetUpload
          owners={activeOwners}
          defaultOwner={
            owner !== "all" && activeOwners.some((o) => o.id === owner)
              ? owner
              : (activeOwners[0]?.id ?? "")
          }
          onClose={() => setUpload(false)}
          onSave={save}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
  const heading = (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ASSETS / {trend ? "TREND" : "STATUS"}</span>
          <h1>
            {trend ? "자산추이" : "자산현황"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {trend
              ? "기간에 따른 흐름과 직전 기간 대비 항목별 증감을 봅니다."
              : "최신 기록 기준으로 지금 자산의 구성을 봅니다."}
          </p>
        </div>
        {/* 좁은 화면에서는 버튼을 아이콘만 남겨 한 줄에 둔다. 이름은 aria-label·title로 남긴다. */}
        <div className="button-row asset-heading-actions">
          <Link
            className="button secondary"
            href={href("/assets/records")}
            aria-label="기록 이력"
            title="기록 이력"
          >
            <History size={16} className="asset-heading-icon" />
            <span>기록 이력</span>
            <ArrowUpRight size={15} className="asset-heading-go" />
          </Link>
          <Link
            className="button secondary"
            href={href("/assets/strategy")}
            aria-label="분할매수 전략"
            title="분할매수 전략"
          >
            <CalendarRange size={16} className="asset-heading-icon" />
            <span>분할매수</span>
            <ArrowUpRight size={15} className="asset-heading-go" />
          </Link>
          <button
            className="button secondary"
            onClick={copyAssets}
            disabled={!activeOwners.length}
            aria-label="자산 복사"
            title="전체 구성원의 최신 자산을 글로 복사"
          >
            <ClipboardCopy size={16} className="asset-heading-icon" />
            <span>자산 복사</span>
          </button>
          <button
            className="button secondary"
            onClick={ownerForm}
            aria-label="소유자 추가"
            title="소유자 추가"
          >
            <UserPlus size={16} className="asset-heading-icon" />
            <span>소유자 추가</span>
          </button>
          <button
            className="button primary"
            onClick={() => (activeOwners.length ? openUpload() : ownerForm())}
            aria-label="자산 기록"
            title="자산 기록"
          >
            <Upload size={16} />
            <span>자산 기록</span>
          </button>
        </div>
      </div>
      {/* 두 화면은 구성원·분류 기준·금액 가리기를 같은 주소 조건으로 이어 쓴다. */}
      <nav className="asset-view-switch" aria-label="자산 화면">
        {views.map((v) => (
          <Link
            key={v.key}
            href={href(`${v.path}${query ? `?${query}` : ""}`)}
            className={view === v.key ? "selected" : ""}
            aria-current={view === v.key ? "page" : undefined}
          >
            {v.label}
          </Link>
        ))}
      </nav>
    </>
  );
  const axisChips = (
    <div className="asset-chips" role="group" aria-label="분류 기준">
      {chartAxes.map((a) => (
        <button
          key={a.key}
          className={axis === a.key ? "selected" : ""}
          onClick={() => update({ axis: a.key })}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
  // 필터는 탭과 상관없이 한 줄에 둔다. 왼쪽은 누구의 자산인지, 오른쪽은 어떻게 볼지다.
  // 기간 범위와 월별/연별은 추이에만 있다. 현황은 최신 기록 하나를 보기 때문이다.
  // 소유자 칩은 데이터가 없어도 항상 그린다. 기록 없는 사람을 고른 뒤 돌아오지 못하면 안 된다.
  const ownerChips = data && (
    <div className="asset-filters">
      <div className="asset-chips" role="group" aria-label="구성원">
        <button
          className={owner === "all" ? "selected" : ""}
          onClick={() => update({ owner: "" })}
        >
          종합
        </button>
        {activeOwners.map((o) => (
          <button
            key={o.id}
            className={owner === o.id ? "selected" : ""}
            onClick={() => update({ owner: o.id })}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div className="asset-filter-options">
        {trend && (
          <div className="asset-chips" role="group" aria-label="기간 범위">
            {assetRanges.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? "selected" : ""}
                onClick={() => update({ range: r.key })}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {trend && (
          <div className="asset-chips" role="group" aria-label="기간 단위">
            {periods.map((p) => (
              <button
                key={p.key}
                className={period === p.key ? "selected" : ""}
                // 연별을 최근 1년으로 보면 한 해뿐이라 비교할 직전 해가 없다. 전체로 넓힌다.
                onClick={() =>
                  update({
                    period: p.key,
                    ...(p.key === "year" && range === "1y"
                      ? { range: "all" }
                      : {}),
                  })
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {axisChips}
        <label className="asset-hide-toggle">
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => toggleHide(e.target.checked)}
          />
          금액 가리기
        </label>
      </div>
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
        {overlays}
      </div>
    );
  if (loading || !data)
    return (
      <div className="asset-page">
        {heading}
        <p className="muted">불러오는 중입니다…</p>
        {overlays}
      </div>
    );
  const summary = data.summaries[axis];
  const groupSummary = data.summaries.group;
  const timeline = data.timelines[axis];
  const share = (n: number, of: number) => assetPct(of > 0 ? n / of : null);
  const drill = (at: string, bucket: string) => {
    const label =
      timeline
        .find((p) => p.period === at)
        ?.buckets.find((b) => b.key === bucket)?.name ?? bucket;
    setDetail({ at, axis, bucket, label });
  };
  // 카드 키와 카드에 담긴 자산그룹 키(구성 칸) 어느 쪽으로도 카드를 찾는다.
  const stockBoard = (key: string | null) => {
    const def = assetStockBoardDefs.find(
      (d) => d.key === key || d.groups.includes(key ?? ""),
    );
    return data.stocks.find((b) => b.key === def?.key && b.count > 0);
  };
  const openStock = stockBoard(stockKey);
  // 주식 그룹은 카드의 전체 보기와 같은 종목 팝업을 연다. 원본 항목 서랍은
  // 계좌·구성원별로 쪼개져 있어 종목 규모와 비중을 읽기 어렵다.
  const openBucket = (key: string) => {
    const board = axis === "group" && stockBoard(key);
    if (board) setStockKey(board.key);
    else if (summary) drill(summary.period, key);
  };
  // 종목 이름은 네이버 증권을 새 창으로 연다. 서버가 이름으로 종목 코드를 찾아 보낸다.
  // 둘러보기는 로그인이 없어 서버 조회를 거치지 않고 바로 "종목명 주가" 검색을 연다.
  const stockHref = (name: string) =>
    demo
      ? naverStockSearchUrl(name)
      : `/api/assets/stock?${new URLSearchParams({ name })}`;
  return (
    <div className={`asset-page${hide ? " asset-amounts-hidden" : ""}`}>
      {heading}
      {!activeOwners.length ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Plus size={30} />
          </div>
          <h3>자산 소유자를 먼저 등록해주세요</h3>
          <p>
            자산현황은 소유자별로 기록합니다. 이름을 추가하면 기록할 수 있어요.
          </p>
          <button className="button primary" onClick={ownerForm}>
            소유자 추가
          </button>
        </div>
      ) : (
        <>
          {ownerChips}
          {!groupSummary ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Plus size={30} />
              </div>
              <h3>이 구성원의 자산 기록이 없습니다</h3>
              <p>
                위에서 다른 구성원을 고르거나, 이 구성원의 자산을 기록해보세요.
              </p>
              <button className="button primary" onClick={openUpload}>
                자산 기록
              </button>
            </div>
          ) : (
            <>
              {data.unclassified > 0 && (
                <div className="asset-warning" role="status">
                  <TriangleAlert size={17} />
                  <span>
                    {hide
                      ? `미분류 자산이 총자산의 ${share(data.unclassified, groupSummary.total)} 있습니다.`
                      : `미분류 자산 ${assetMoney(data.unclassified)}이 있습니다.`}{" "}
                    어느 그룹인지 확인하고 다시 기록해주세요.
                  </span>
                </div>
              )}
              {trend ? (
                <>
                  <AssetTrendView
                    data={data}
                    axis={axis}
                    period={period}
                    hide={hide}
                    onDrill={drill}
                  />
                </>
              ) : (
                <>
                  <AssetStatusKpis
                    data={data}
                    summary={groupSummary}
                    hide={hide}
                  />
                  <section className="panel">
                    <div className="section-heading compact">
                      <h2>자산 구성</h2>
                      <span className="muted small">
                        {periodLabel(groupSummary.period)} 기준 · 조각이나 칸을
                        누르면 종목을 봅니다
                      </span>
                    </div>
                    {/* 도넛은 각 항목의 비중을, 트리맵은 금액의 크기를 읽는다. 넓은 화면에서 트리맵만 두면
                        칸이 가로로 늘어나 비중을 눈으로 비교하기 어렵다. */}
                    <div className="asset-compose">
                      <AssetPie
                        rows={summary?.rows ?? []}
                        total={summary?.total ?? 0}
                        hide={hide}
                        onSlice={openBucket}
                      />
                      <AssetTreemap
                        rows={summary?.rows ?? []}
                        total={summary?.total ?? 0}
                        hide={hide}
                        onCell={openBucket}
                      />
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-heading compact">
                      <h2>위험 · 안전 자산</h2>
                      <span className="muted small">
                        {periodLabel(groupSummary.period)} 기준 · 세부 분류
                        비율은 각 묶음 안의 비중
                      </span>
                    </div>
                    {summary && (
                      <AssetRiskBoard
                        summary={summary}
                        axis={axis}
                        onRow={(key) => drill(summary.period, key)}
                        hide={hide}
                      />
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-heading compact">
                      <h2>주식 보유 현황</h2>
                      <span className="muted small">
                        {periodLabel(groupSummary.period)} 최신 기록 · 금액 상위
                        5종목 · 종목 수익률
                      </span>
                    </div>
                    <StockProfitLine
                      label="전체 수익"
                      profit={assetStockProfitTotal(data.stocks)}
                      hide={hide}
                      className="asset-stock-total"
                    />
                    <div className="asset-stock-grid">
                      {data.stocks.map((board) => (
                        <AssetStockCard
                          key={board.key}
                          board={board}
                          assetTotal={hide ? groupSummary.total : null}
                          stockHref={stockHref}
                          onOpen={() => setStockKey(board.key)}
                        />
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
      {openStock && groupSummary && (
        <AssetStockDialog
          board={openStock}
          period={periodLabel(groupSummary.period)}
          assetTotal={hide ? groupSummary.total : null}
          stockHref={stockHref}
          onClose={() => setStockKey(null)}
        />
      )}
      {overlays}
    </div>
  );
}
// 현황의 네 칸: 총자산, 원화·달러, 위험·안전, 구성원별. 모두 최신 기간 기준이다.
function AssetStatusKpis({
  data,
  summary,
  hide,
}: {
  data: AssetOverview;
  summary: AssetSummary;
  hide: boolean;
}) {
  const mix = data.currencyMix;
  const mixTotal = mix.KRW + mix.USD + mix.NONE;
  const risk = data.summaries.risk;
  const riskAmount = (key: string) =>
    risk?.rows.find((r) => r.key === key)?.amount ?? 0;
  const riskTotal = risk?.total ?? 0;
  const ownerSum = data.ownerTotals.reduce((n, o) => n + o.total, 0);
  const share = (n: number, of: number) => assetPct(of > 0 ? n / of : null);
  // 두 값을 비율로 나란히 적고 아래에 막대를 둔다. 나머지(통화 없는 금·미분류)는 막대와 한 줄로만 보인다.
  const pair = (
    items: { key: string; label: string; amount: number }[],
    rest: { key: string; label: string; amount: number },
    total: number,
  ) => (
    <>
      <div className="asset-kpi-mix">
        {items.map((item) => (
          <div key={item.key}>
            <span>
              <i style={{ background: assetColor(item.key) }} />
              {item.label}
            </span>
            <strong className="asset-kpi-value">
              {share(item.amount, total)}
            </strong>
            {!hide && <small>{assetCompact(item.amount)}</small>}
          </div>
        ))}
      </div>
      <div className="asset-mix-bar">
        {[...items, rest].map((item) => (
          <i
            key={item.key}
            style={{
              width: `${total > 0 ? (item.amount / total) * 100 : 0}%`,
              background: assetColor(item.key),
            }}
          />
        ))}
      </div>
      {rest.amount > 0 && (
        <p className="asset-kpi-sub">
          <i
            className="asset-dot"
            style={{ background: assetColor(rest.key) }}
          />
          {rest.label} {!hide && `${assetCompact(rest.amount)} · `}
          {share(rest.amount, total)}
        </p>
      )}
    </>
  );
  return (
    <section className="asset-kpis" aria-label="자산 요약">
      <div className="asset-kpi">
        <span className="asset-kpi-label">
          총자산 · {periodLabel(summary.period)} 기준
        </span>
        <strong className="asset-kpi-value asset-kpi-big">
          {hide ? ASSET_HIDDEN : assetMoney(summary.total)}
        </strong>
        <p className="asset-kpi-sub">
          {summary.change === null ? (
            "직전 비교 없음"
          ) : (
            <>
              {periodLabel(summary.previous_period!)} 대비{" "}
              <b className={assetChangeTone(summary.change)}>
                {hide
                  ? assetSignedPct(summary.change_rate)
                  : `${assetSignedMoney(summary.change)} (${assetSignedPct(summary.change_rate)})`}
              </b>
            </>
          )}
        </p>
        {summary.carried.length > 0 && (
          <p className="asset-kpi-sub">
            {data.ownerTotals
              .filter((o) => summary.carried.includes(o.owner_id))
              .map((o) => o.name)
              .join(", ")}
            는 직전 기록을 이어 씀
          </p>
        )}
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">원화 / 달러 비율</span>
        {pair(
          [
            { key: "KRW", label: "원화", amount: mix.KRW },
            { key: "USD", label: "달러", amount: mix.USD },
          ],
          { key: "NONE", label: "기타", amount: mix.NONE },
          mixTotal,
        )}
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">위험 / 안전 비율</span>
        {pair(
          [
            { key: "RISKY", label: "위험", amount: riskAmount("RISKY") },
            { key: "SAFE", label: "안전", amount: riskAmount("SAFE") },
          ],
          { key: "UNKNOWN", label: "미분류", amount: riskAmount("UNKNOWN") },
          riskTotal,
        )}
      </div>
      <div className="asset-kpi">
        <span className="asset-kpi-label">구성원별 자산</span>
        {/* 기록 주기가 다른 구성원이 있으므로 각 줄에 그 사람의 기준일을 함께 적는다. */}
        <ul className="asset-kpi-owners">
          {data.ownerTotals.map((o) => (
            <li key={o.owner_id}>
              {/* 가릴 때는 금액 자리에 비중을 올리고 이름 옆 비중은 뺀다. */}
              <span>
                {o.name}
                {!hide && <i>{share(o.total, ownerSum)}</i>}
              </span>
              <b>{hide ? share(o.total, ownerSum) : assetCompact(o.total)}</b>
              <small>
                {o.as_of ? `${o.as_of.replaceAll("-", ".")} 기록` : "기록 없음"}
              </small>
              <em className={assetChangeTone(o.change)}>
                {assetChangeText(
                  o.change,
                  o.change === null
                    ? null
                    : assetChangeRate(o.total, o.total - o.change),
                  hide,
                )}
              </em>
            </li>
          ))}
        </ul>
        <div className="asset-mix-bar">
          {data.ownerTotals.map((o, i) => (
            <i
              key={o.owner_id}
              style={{
                width: `${ownerSum > 0 ? (o.total / ownerSum) * 100 : 0}%`,
                background: ownerColors[i % ownerColors.length],
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
// 구성원 막대 색. 자산 그룹 색과 겹치지 않는 차분한 색을 쓴다.
const ownerColors = ["#365b43", "#b67b72", "#8a9a5b", "#5f7a8a"];
// 위험·안전은 두 덩어리의 비율이 먼저고, 그 안의 세부 분류는 각 덩어리를 분모로 본다.
// 전체 대비 비중으로 적으면 "안전 자산 안에서 예적금이 얼마인지"를 읽을 수 없다.
const riskSides: { risk: AssetRisk | null; key: string; label: string }[] = [
  { risk: "RISKY", key: "RISKY", label: "위험" },
  { risk: "SAFE", key: "SAFE", label: "안전" },
  { risk: null, key: "UNKNOWN", label: "미분류" },
];
// 분류 기준을 따른다. 상위 그룹은 한 위험 분류 안에만 있으므로 그 그룹의 위험으로 나눈다.
const riskOf = (key: string, axis: AssetAxis) =>
  (axis === "parent"
    ? assetGroups.find((g) => g.parent === key)?.risk
    : findAssetGroup(key)?.risk) ?? null;
function AssetRiskBoard({
  summary,
  axis,
  onRow,
  hide,
}: {
  summary: AssetSummary;
  axis: AssetAxis;
  onRow: (key: string) => void;
  hide: boolean;
}) {
  const sides = riskSides
    .map((side) => {
      const rows = summary.rows
        .filter((r) => r.amount > 0 && riskOf(r.key, axis) === side.risk)
        .sort((a, b) => b.amount - a.amount);
      return {
        ...side,
        rows,
        amount: rows.reduce((n, r) => n + r.amount, 0),
        // 막대는 100%가 아니라 그 묶음의 최대 항목을 가득 찬 길이로 쓴다.
        // 분류가 잘게 쪼개질수록 모든 막대가 짧아져서 서로 비교가 안 되기 때문이다.
        max: rows[0]?.amount ?? 0,
      };
    })
    .filter((side) => side.amount > 0);
  const total = summary.total;
  const share = (n: number) => (total > 0 ? n / total : null);
  return (
    <>
      <div
        className="asset-risk-track"
        role="img"
        aria-label={sides
          .map((s) => `${s.label} ${assetPct(share(s.amount))}`)
          .join(", ")}
      >
        {sides.map((side) => (
          <span
            key={side.key}
            style={{
              width: `${total > 0 ? (side.amount / total) * 100 : 0}%`,
              background: assetColor(side.key),
            }}
          >
            {side.label} {assetPct(share(side.amount))}
          </span>
        ))}
      </div>
      <div className="asset-risk-cols">
        {sides.map((side) => (
          <div className="asset-risk-col" key={side.key}>
            <header>
              <span
                className="asset-risk-tag"
                style={{ color: assetColor(side.key) }}
              >
                <i style={{ background: assetColor(side.key) }} />
                {side.label}
              </span>
              <strong>{assetPct(share(side.amount))}</strong>
              <small>
                {!hide && `${assetCompact(side.amount)} · `}
                {side.rows.length}개 분류
              </small>
            </header>
            <ul>
              {side.rows.map((row) => (
                <li key={row.key}>
                  <button onClick={() => onRow(row.key)}>
                    <span>{row.name}</span>
                    <i className="asset-bar">
                      <b
                        style={{
                          width: `${side.max > 0 ? (row.amount / side.max) * 100 : 0}%`,
                          background: assetColor(row.key),
                        }}
                      />
                    </i>
                    <em>
                      {assetPct(
                        side.amount > 0 ? row.amount / side.amount : null,
                      )}
                    </em>
                    {!hide && <b>{assetCompact(row.amount)}</b>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
// 종목은 사람이 아니라 종목 단위로 본다. 같은 종목을 둘이 나눠 들고 있어도 규모는 하나다.
const shares = (n: number | null) =>
  n === null ? "" : `${Math.round(n).toLocaleString("ko-KR")}주`;
const STOCK_TOP = 5;
// assetTotal이 있으면 금액 가리기다. 그룹 합계 자리에 총자산 대비 비중을 적고 수량은 뺀다.
// 수량은 비율로 바꿀 수 없고, 시세를 알면 금액이 되므로 함께 가린다.
function AssetStockCard({
  board,
  assetTotal,
  stockHref,
  onOpen,
}: {
  board: AssetStockBoard;
  assetTotal: number | null;
  stockHref: (name: string) => string;
  onOpen: () => void;
}) {
  const top = board.holdings.slice(0, STOCK_TOP);
  const hide = assetTotal !== null;
  return (
    <article className="asset-stock-card">
      <header>
        <button
          onClick={onOpen}
          disabled={!board.count}
          title={`${board.name} 전체 종목 보기`}
        >
          <i
            className="asset-dot"
            style={{ background: assetColor(board.key) }}
          />
          {board.name}
        </button>
        <strong>
          {hide
            ? `총자산의 ${assetPct(assetTotal > 0 ? board.total / assetTotal : null)}`
            : assetCompact(board.total)}
        </strong>
      </header>
      <p className="asset-stock-meta">
        {board.count}종목
        {!hide &&
          board.quantity !== null &&
          ` · 보유 ${shares(board.quantity)}`}
      </p>
      <StockProfitLine label="수익" profit={board.profit} hide={hide} />
      {top.length ? (
        <>
          <AssetHoldingList
            board={board}
            holdings={top}
            hide={hide}
            stockHref={stockHref}
            profit="rate"
          />
          <button className="asset-stock-more" onClick={onOpen}>
            전체 {board.count}종목 · 비중 보기 <ChevronRight size={15} />
          </button>
        </>
      ) : (
        <p className="muted small">기록된 종목이 없습니다.</p>
      )}
    </article>
  );
}
// 매입 원금 대비 수익. 금액을 가리면 수익률만 적는다.
// 수익금·수익률이 없는 종목은 원금을 몰라 빼므로 몇 종목을 뺐는지 함께 적는다.
function StockProfitLine({
  label,
  profit,
  hide,
  className = "asset-stock-profit",
}: {
  label: string;
  profit: AssetStockProfit;
  hide: boolean;
  className?: string;
}) {
  if (profit.rate === null) {
    if (!profit.missing) return null;
    return <p className={className}>{label} 정보 없음</p>;
  }
  return (
    <p className={className}>
      {label}{" "}
      <b className={assetChangeTone(profit.profit)}>
        {hide
          ? assetSignedPct(profit.rate)
          : `${assetSignedMoney(profit.profit)} (${assetSignedPct(profit.rate)})`}
      </b>
      {profit.missing > 0 && (
        <small> · 수익 정보 없는 {profit.missing}종목 제외</small>
      )}
    </p>
  );
}
// 종목 수익률은 원본 항목 서랍과 같이 소수 둘째 자리까지 적는다.
const holdingRate = (n: number | null) =>
  n === null ? "—" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
// 카드와 팝업이 같은 줄 모양을 쓴다. 막대는 그 그룹의 1위 종목을 가득 찬 길이로 그린다.
function AssetHoldingList({
  board,
  holdings,
  hide,
  stockHref,
  profit,
}: {
  board: AssetStockBoard;
  holdings: AssetStockBoard["holdings"];
  hide: boolean;
  // 카드는 자리가 좁아 수익률만 오른쪽 칸에 적고, 팝업은 수익금과 수익률을 함께 적는다.
  profit: "rate" | "full";
  stockHref: (name: string) => string;
}) {
  const max = board.holdings[0]?.amount ?? 0;
  return (
    <ol className={`asset-stock-list${profit === "rate" ? " with-rate" : ""}`}>
      {holdings.map((holding, i) => (
        <li key={holding.name}>
          <span className="asset-rank">{i + 1}</span>
          <div className="asset-stock-name">
            <strong>
              <a
                className="asset-stock-link"
                href={stockHref(holding.name)}
                target="_blank"
                rel="noopener noreferrer"
                title={`${holding.name} 네이버 증권에서 보기`}
              >
                <span>{holding.name}</span>
                <ExternalLink size={12} aria-hidden />
              </a>
            </strong>
            {holding.detail && <small>{holding.detail}</small>}
          </div>
          <div className="asset-stock-figure">
            {hide ? (
              <strong>
                {assetPct(
                  board.total > 0 ? holding.amount / board.total : null,
                )}
              </strong>
            ) : (
              <>
                <strong>{assetCompact(holding.amount)}</strong>
                <small>
                  {assetPct(
                    board.total > 0 ? holding.amount / board.total : null,
                  )}
                  {holding.quantity !== null &&
                    ` · ${shares(holding.quantity)}`}
                </small>
              </>
            )}
            {profit === "full" && holding.profit !== null && (
              <em className={assetChangeTone(holding.profit)}>
                {hide
                  ? holdingRate(holding.profit_rate)
                  : `${assetSignedMoney(holding.profit)}${holding.profit_rate === null ? "" : ` (${holdingRate(holding.profit_rate)})`}`}
              </em>
            )}
          </div>
          {/* 수익은 빨강, 손실은 파랑. 수익 정보가 없는 종목은 빈칸이 아니라 —로 둔다. */}
          {profit === "rate" && (
            <em
              className={`asset-stock-rate ${holding.profit_rate === null ? "flat" : assetChangeTone(holding.profit_rate)}`}
            >
              {holdingRate(holding.profit_rate)}
            </em>
          )}
          <i className="asset-bar">
            <b
              style={{
                width: `${max > 0 ? (holding.amount / max) * 100 : 0}%`,
                background: assetColor(board.key),
              }}
            />
          </i>
        </li>
      ))}
    </ol>
  );
}
// 카드의 전체 보기와 도넛의 주식 조각이 여는 팝업. 금액순 전체 종목과 그룹 내 비중을 본다.
function AssetStockDialog({
  board,
  period,
  assetTotal,
  stockHref,
  onClose,
}: {
  board: AssetStockBoard;
  period: string;
  assetTotal: number | null;
  stockHref: (name: string) => string;
  onClose: () => void;
}) {
  const hide = assetTotal !== null;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <dialog
      ref={dialog}
      className="record-dialog asset-stock-dialog"
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={`${board.name} 전체 종목`}
    >
      <header>
        <div>
          <span className="eyebrow">{period} 최신 기록</span>
          <h2>
            <i
              className="asset-dot"
              style={{ background: assetColor(board.key) }}
            />
            {board.name}
            <strong>
              {hide
                ? `총자산의 ${assetPct(assetTotal > 0 ? board.total / assetTotal : null)}`
                : assetMoney(board.total)}
            </strong>
          </h2>
          <p className="asset-stock-meta">
            {board.count}종목
            {!hide &&
              board.quantity !== null &&
              ` · 보유 ${shares(board.quantity)}`}{" "}
            · 비중은 그룹 합계 대비
          </p>
          <StockProfitLine
            label="전체 수익"
            profit={board.profit}
            hide={hide}
          />
        </div>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="asset-stock-dialog-list">
        <AssetHoldingList
          board={board}
          holdings={board.holdings}
          hide={hide}
          stockHref={stockHref}
          profit="full"
        />
      </div>
    </dialog>
  );
}
