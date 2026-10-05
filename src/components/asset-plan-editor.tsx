"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import {
  ASSET_PLAN_MAX_ITEMS,
  ASSET_PLAN_MAX_MONTHS,
  assetPlanKinds,
  itemAmount,
  monthlyAmount,
  digitsOnly,
  groupDigits,
  isaAmount,
  weightSum,
  weightsComplete,
  type AssetPlan,
  type AssetPlanHolding,
  type AssetPlanKind,
} from "@/lib/asset-plans";
import { assetCompact, assetGroupName, assetMoney } from "@/lib/assets";
import type { Operation } from "@/lib/contracts";

type Row = {
  key: string;
  name: string;
  code: string;
  market: string;
  weight: string;
  isa: boolean;
};
type Suggestion = { name: string; code: string; market: string };
const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();
const newRow = (): Row => ({
  key: crypto.randomUUID(),
  name: "",
  code: "",
  market: "",
  weight: "",
  isa: false,
});

// 분할매수 그룹 하나(월급·현금)의 금액과 종목 비중을 고친다. 저장하면 종목 목록을 통째로 교체한다.
// 종목 칸에 티커나 이름을 넣고 찾기를 누르면 네이버 증권에서 정확한 종목명을 찾아 채운다.
export function AssetPlanEditor({
  kind,
  ownerId,
  ownerName,
  plan,
  holdings,
  onClose,
  onSave,
}: {
  kind: AssetPlanKind;
  ownerId: string;
  ownerName: string;
  plan: AssetPlan | null;
  // 구성원들이 지금 가진 주식 종목. 종목 칸을 누르면 여기서 고를 수 있다.
  holdings: AssetPlanHolding[];
  onClose: () => void;
  onSave: (
    operation: Operation,
    input: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const info = assetPlanKinds.find((k) => k.key === kind)!;
  const [amount, setAmount] = useState(plan ? String(plan.amount) : "");
  const [months, setMonths] = useState(
    plan?.months ? String(plan.months) : kind === "cash" ? "12" : "",
  );
  const [rows, setRows] = useState<Row[]>(() =>
    plan?.items.length
      ? plan.items.map((i) => ({
          key: crypto.randomUUID(),
          name: i.name,
          code: i.code,
          market: i.market,
          weight: String(i.weight),
          isa: i.isa,
        }))
      : [newRow()],
  );
  const [searching, setSearching] = useState<string | null>(null);
  const [found, setFound] = useState<{
    row: string;
    items: Suggestion[];
    message: string;
  } | null>(null);
  // 보유 종목 목록을 펼친 줄. 종목 칸에 들어가면 열리고 나오면 닫힌다.
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const change = (rowKey: string, patch: Partial<Row>) =>
    setRows((list) =>
      list.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)),
    );
  function apply(rowKey: string, s: Suggestion) {
    change(rowKey, { name: s.name, code: s.code, market: s.market });
    setFound(null);
  }
  // quiet는 보유 종목을 고른 직후 코드만 채우려고 찾을 때다. 정확히 맞는 하나가 없으면 묻지 않고 이름만 둔다.
  async function search(row: Row, quiet = false) {
    const q = row.name.trim();
    if (!q || searching) return;
    setPicking(null);
    setSearching(row.key);
    setFound(null);
    try {
      const r = await fetch(
        `/api/assets/stock/search?${new URLSearchParams({ q })}`,
        { cache: "no-store" },
      );
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message ?? "찾지 못했습니다.");
      const items = body.items as Suggestion[];
      // 티커·코드·이름이 정확히 같은 결과가 하나뿐이면 묻지 않고 채운다.
      const exact = items.filter(
        (s) =>
          normalize(s.code) === normalize(q) ||
          normalize(s.name) === normalize(q),
      );
      if (exact.length === 1) apply(row.key, exact[0]);
      else if (!quiet)
        setFound({
          row: row.key,
          items,
          message: items.length
            ? "종목을 골라주세요."
            : "찾은 종목이 없습니다. 이름은 앞부분부터 정확히(예: RISE 미국나스닥100) 적거나 티커·코드로 찾아보세요. 적은 이름 그대로 저장할 수도 있습니다.",
        });
    } catch (e) {
      if (!quiet)
        setFound({ row: row.key, items: [], message: (e as Error).message });
    } finally {
      setSearching(null);
    }
  }
  // 자산 기록에는 종목 코드가 없으므로 이름을 채운 뒤 네이버 증권에서 같은 이름을 찾아 코드를 붙인다.
  function pickHolding(row: Row, h: AssetPlanHolding) {
    change(row.key, { name: h.name, code: "", market: "" });
    setPicking(null);
    setFound(null);
    search({ ...row, name: h.name }, true);
  }
  // 적은 글자가 들어간 보유 종목. 이 구성원이 가진 종목을 먼저, 그다음 금액이 큰 순서로 둔다.
  function holdingOptions(row: Row) {
    const q = normalize(row.name);
    return holdings
      .filter((h) => !q || normalize(h.name).includes(q))
      .sort(
        (a, b) =>
          Number(b.owner_ids.includes(ownerId)) -
            Number(a.owner_ids.includes(ownerId)) || b.amount - a.amount,
      )
      .slice(0, 50);
  }
  const total = Number(amount || 0);
  const monthCount = Number(months || 0);
  const filled = rows.filter((r) => r.name.trim() || r.weight);
  const parsed = filled.map((r) => ({
    name: r.name.trim(),
    code: r.code,
    market: r.market,
    weight: Number(r.weight),
    isa: r.isa,
  }));
  const sum = weightSum(parsed.filter((i) => Number.isFinite(i.weight)));
  const monthly =
    kind === "cash"
      ? monthlyAmount({ kind, amount: total, months: monthCount || 1 })
      : total;
  const problems: string[] = [];
  if (!amount) problems.push("금액을 입력해주세요.");
  if (
    kind === "cash" &&
    !(
      Number.isInteger(monthCount) &&
      monthCount >= 1 &&
      monthCount <= ASSET_PLAN_MAX_MONTHS
    )
  )
    problems.push(`개월 수는 1~${ASSET_PLAN_MAX_MONTHS} 사이로 입력해주세요.`);
  if (parsed.some((i) => !i.name))
    problems.push("종목 이름이 빈 줄이 있습니다.");
  if (parsed.some((i) => !(i.weight > 0 && i.weight <= 100)))
    problems.push("비중은 0보다 크고 100 이하인 숫자로 입력해주세요.");
  if (parsed.length && !weightsComplete(parsed))
    problems.push(`비중 합계가 100%가 아닙니다 (지금 ${sum}%).`);
  async function submit() {
    if (problems.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave("asset_save_buy_plan", {
        idempotency_key: key.current,
        owner_id: ownerId,
        kind,
        expected_version: plan?.version ?? null,
        amount: total,
        months: kind === "cash" ? monthCount : null,
        items: parsed,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      // 같은 키로 다시 보내면 서버가 첫 시도의 결과를 돌려준다. 고쳐서 다시 저장하는 것은 새 작업이다.
      key.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="record-dialog asset-upload-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      aria-label={`${info.title} 수정`}
    >
      <div className="asset-upload-body">
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">ASSETS / STRATEGY · {ownerName}</span>
            <h2>{info.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <p className="muted small">{info.description}</p>
        <div className="asset-upload-fields">
          <label className="field">
            <span>
              {kind === "cash" ? "나눠 살 총액 (원)" : "매달 투자 금액 (원)"}
            </span>
            <input
              inputMode="numeric"
              value={groupDigits(amount)}
              disabled={busy}
              placeholder={kind === "cash" ? "10,000,000" : "1,000,000"}
              onChange={(e) =>
                setAmount(digitsOnly(e.target.value).slice(0, 13))
              }
            />
          </label>
          {kind === "cash" ? (
            <label className="field">
              <span>나눌 개월 수</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={ASSET_PLAN_MAX_MONTHS}
                value={months}
                disabled={busy}
                onChange={(e) =>
                  setMonths(digitsOnly(e.target.value).slice(0, 3))
                }
              />
              <small>
                매달 {assetMoney(monthly)}
                {total > monthly * monthCount
                  ? ` · 남는 ${assetMoney(total - monthly * monthCount)}은 마지막 달에`
                  : ""}
              </small>
            </label>
          ) : (
            <div className="field">
              <span>한 달 매수액</span>
              <strong className="asset-plan-monthly">
                {assetMoney(monthly)}
              </strong>
            </div>
          )}
        </div>
        <div className="asset-plan-rows" role="group" aria-label="종목과 비중">
          <div
            className="asset-plan-row asset-plan-row-head"
            aria-hidden="true"
          >
            <span>종목 (보유 종목에서 고르거나 티커·이름 입력 후 찾기)</span>
            <span>비중</span>
            <span>ISA</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.key} className="asset-plan-row-wrap">
              <div className="asset-plan-row">
                <div className="asset-plan-name">
                  <input
                    value={row.name}
                    disabled={busy}
                    placeholder="예: VOO, 360750, TIGER 미국S&P500"
                    aria-label="종목"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls={`holdings-${row.key}`}
                    aria-expanded={picking === row.key}
                    autoComplete="off"
                    onFocus={() => setPicking(row.key)}
                    onBlur={() => setPicking(null)}
                    onChange={(e) => {
                      change(row.key, {
                        name: e.target.value,
                        code: "",
                        market: "",
                      });
                      setPicking(row.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && picking === row.key) {
                        // 창 닫기보다 목록 닫기가 먼저다.
                        e.preventDefault();
                        e.stopPropagation();
                        setPicking(null);
                      }
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        search(row);
                      }
                    }}
                  />
                  <button
                    className="icon-button"
                    aria-label="종목 찾기"
                    title="네이버 증권에서 종목 찾기"
                    disabled={busy || !row.name.trim() || searching !== null}
                    onClick={() => search(row)}
                  >
                    {searching === row.key ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Search size={16} />
                    )}
                  </button>
                </div>
                <label className="asset-plan-weight">
                  <input
                    inputMode="decimal"
                    value={row.weight}
                    disabled={busy}
                    aria-label="비중(%)"
                    placeholder="0"
                    onChange={(e) =>
                      change(row.key, {
                        weight: e.target.value
                          .replace(/[^0-9.]/g, "")
                          .slice(0, 6),
                      })
                    }
                  />
                  <span>%</span>
                </label>
                <label
                  className="asset-plan-isa-check"
                  title="ISA 계좌로 삽니다"
                >
                  <input
                    type="checkbox"
                    checked={row.isa}
                    disabled={busy}
                    aria-label="ISA 계좌로 사기"
                    onChange={(e) => change(row.key, { isa: e.target.checked })}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="이 종목 빼기"
                  disabled={busy}
                  onClick={() =>
                    setRows((list) =>
                      list.length > 1
                        ? list.filter((r) => r.key !== row.key)
                        : [newRow()],
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <small className="asset-plan-row-meta">
                {[row.code, row.market].filter(Boolean).join(" · ")}
                {Number(row.weight) > 0 && monthly > 0
                  ? `${row.code || row.market ? " · " : ""}월 ${assetMoney(itemAmount(monthly, Number(row.weight)))}`
                  : ""}
              </small>
              {picking === row.key &&
                found?.row !== row.key &&
                holdingOptions(row).length > 0 && (
                  <div
                    id={`holdings-${row.key}`}
                    className="asset-plan-holdings"
                    role="listbox"
                    aria-label="보유 종목"
                  >
                    <p>보유 종목 · 가장 최근 자산 기록 기준</p>
                    {holdingOptions(row).map((h) => (
                      <button
                        key={h.name}
                        type="button"
                        role="option"
                        aria-selected={h.name === row.name}
                        // 누르는 순간 입력 칸이 blur되어 목록이 사라지지 않게 한다.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickHolding(row, h)}
                      >
                        <b>{h.name}</b>
                        <span>
                          {h.owner_ids.includes(ownerId) && (
                            <em>{ownerName}</em>
                          )}
                          {assetGroupName(h.group_key)} ·{" "}
                          {assetCompact(h.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              {found?.row === row.key && (
                <div className="asset-plan-found" role="listbox">
                  <p className="muted small">{found.message}</p>
                  {found.items.map((s) => (
                    <button
                      key={`${s.code}-${s.name}`}
                      role="option"
                      aria-selected={false}
                      onClick={() => apply(row.key, s)}
                    >
                      <b>{s.name}</b>
                      <span>
                        {[s.code, s.market].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="asset-plan-rows-foot">
            <button
              className="button secondary"
              disabled={busy || rows.length >= ASSET_PLAN_MAX_ITEMS}
              onClick={() => setRows((list) => [...list, newRow()])}
            >
              <Plus size={15} /> 종목 추가
            </button>
            <span
              className={`asset-plan-sum${
                parsed.length && !weightsComplete(parsed) ? " off" : ""
              }`}
            >
              {parsed.some((i) => i.isa) && monthly > 0 && (
                <>
                  ISA 월{" "}
                  <b className="isa">
                    {assetMoney(
                      isaAmount(
                        monthly,
                        parsed.filter((i) => i.weight > 0),
                      ),
                    )}
                  </b>
                  {" · "}
                </>
              )}
              비중 합계 <b>{sum}%</b>
            </span>
          </div>
        </div>
        {problems.length > 0 && (amount || filled.length > 0) && (
          <ul className="asset-plan-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {error && <div className="error-box">{error}</div>}
        <div className="dialog-footer">
          <button
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="button primary"
            disabled={problems.length > 0 || busy}
            onClick={submit}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            저장
          </button>
        </div>
      </div>
    </dialog>
  );
}
