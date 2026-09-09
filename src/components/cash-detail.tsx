"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import {
  cashMoney,
  categoryName,
  filteredCash,
  type CashFilter,
  type CashRow,
} from "@/lib/cash";

export function CashModal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`cash-dialog${drawer ? " cash-detail" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cash-dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          autoFocus
          className="icon-button"
          onClick={onClose}
          aria-label={drawer ? "거래 내역 닫기" : "차트 닫기"}
        >
          <X />
        </button>
      </div>
      <div className="cash-dialog-body">{children}</div>
    </dialog>
  );
}

export function CashTransactions({ rows }: { rows: CashRow[] }) {
  return (
    <div className="cash-transactions">
      {rows.map((r) => (
        <article className="cash-transaction" key={r.id}>
          <time>{r.date}</time>
          <div>
            <strong>{r.memo || r.category}</strong>
            <p>
              {r.member} · {r.category}
              {r.subCategory && ` / ${r.subCategory}`} ·{" "}
              {r.asset || "결제수단 미입력"}
            </p>
            {r.currency !== "KRW" && (
              <small>
                원본 {r.originalAmount?.toLocaleString()} {r.currency}
              </small>
            )}
          </div>
          <span className={r.type === "수입" ? "cash-income" : ""}>
            <small>{r.type}</small>
            <strong>{cashMoney(r.amount)}</strong>
          </span>
        </article>
      ))}
    </div>
  );
}

type Result = {
  rows: CashRow[];
  count: number;
  income: number;
  expense: number;
};
export type CashDetailSelection = { title: string; query: string };
export function CashDetail({
  selection,
  onClose,
  demo,
}: {
  selection: CashDetailSelection;
  onClose: () => void;
  demo?: { rows: CashRow[]; filter: CashFilter };
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date-desc");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Result } | null>(
    null,
  );
  const [error, setError] = useState("");
  const params = new URLSearchParams(selection.query);
  params.set("mode", "transactions");
  params.set("page", String(page));
  params.set("sort", sort);
  const query = params.toString();
  const data = result?.key === query ? result.data : null;
  const demoRows = demo?.rows,
    demoFilter = demo?.filter;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setError("");
      try {
        let body: Result;
        if (demoRows && demoFilter) {
          const p = new URLSearchParams(query);
          const rows = filteredCash(demoRows, {
            ...demoFilter,
            from: p.get("from")!,
            to: p.get("to")!,
            asset: p.get("asset") || "",
          }).filter(
            (r) =>
              (!p.get("type") || r.type === p.get("type")) &&
              (!p.get("category") ||
                categoryName(r, demoFilter.expandOther) ===
                  p.get("category")) &&
              (!p.has("sub") || (r.subCategory || "미분류") === p.get("sub")) &&
              (p.get("assetMissing") !== "true" || !r.asset),
          );
          rows.sort((a, b) =>
            sort === "amount-asc"
              ? a.amount - b.amount
              : sort === "amount-desc"
                ? b.amount - a.amount
                : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
          );
          body = {
            rows: rows.slice((page - 1) * 50, page * 50),
            count: rows.length,
            income: rows
              .filter((r) => r.type === "수입")
              .reduce((n, r) => n + r.amount, 0),
            expense: rows
              .filter((r) => r.type === "지출")
              .reduce((n, r) => n + r.amount, 0),
          };
        } else {
          const response = await fetch(`/api/cash?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const value = await response.json();
          if (!response.ok)
            throw Error(value.error?.message || "내역을 읽지 못했습니다.");
          body = value;
        }
        if (active) setResult({ key: query, data: body });
      } catch (e) {
        if (active && (e as Error).name !== "AbortError")
          setError((e as Error).message);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, page, sort, retry, demoRows, demoFilter]);
  return (
    <CashModal title={selection.title} drawer onClose={onClose}>
      <p className="cash-detail-scope">
        {params.get("from")} — {params.get("to")} ·{" "}
        {params.get("member") || "전체 자료"}
      </p>
      <p className="muted small">
        현재 분석 조건에 해당하는 거래입니다. 닫으면 보던 위치로 돌아갑니다.
      </p>
      <div className="cash-transaction-toolbar">
        <select
          aria-label="상세 거래 정렬"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="date-desc">날짜 최신순</option>
          <option value="amount-desc">금액 높은순</option>
          <option value="amount-asc">금액 낮은순</option>
        </select>
        {!demo && (
          <a
            className="button secondary"
            href={`/api/cash?${query}&export=csv`}
          >
            <Download size={14} />
            CSV
          </a>
        )}
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="cash-empty">
          거래 내역을 불러오는 중…
        </p>
      ) : (
        <>
          <p className="cash-result-count" aria-live="polite">
            {data.count.toLocaleString()}건 · 수입 {cashMoney(data.income)} ·
            지출 {cashMoney(data.expense)}
          </p>
          <CashTransactions rows={data.rows} />
          {!data.rows.length && (
            <p className="cash-empty">조건에 맞는 거래가 없습니다.</p>
          )}
          <div className="cash-pagination">
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              이전
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(data.count / 50))}
            </span>
            <button
              className="button secondary"
              disabled={page * 50 >= data.count}
              onClick={() => setPage(page + 1)}
            >
              다음
            </button>
          </div>
        </>
      )}
    </CashModal>
  );
}
