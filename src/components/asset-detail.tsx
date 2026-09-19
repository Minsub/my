"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  assetMoney,
  assetPct,
  assetSignedMoney,
  periodLabel,
  type AssetAxis,
  type AssetPeriod,
} from "@/lib/assets";
import type { AssetItemRow } from "@/server/assets";
export type AssetDetailTarget = {
  at: string;
  axis: AssetAxis;
  bucket: string;
  label: string;
};
// 그래프나 표의 한 묶음을 눌렀을 때 그 안의 원본 종목을 오른쪽에서 밀어 보여준다.
export function AssetDetail({
  target,
  owner,
  period,
  demo,
  demoItems,
  onClose,
}: {
  target: AssetDetailTarget;
  owner: string;
  period: AssetPeriod;
  demo?: boolean;
  demoItems?: (t: AssetDetailTarget) => AssetItemRow[];
  onClose: () => void;
}) {
  const [items, setItems] = useState<AssetItemRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        if (demo) {
          if (live) setItems(demoItems?.(target) ?? []);
          return;
        }
        const q = new URLSearchParams({
          view: "items",
          owner,
          period,
          axis: target.axis,
          at: target.at,
          bucket: target.bucket,
        });
        const r = await fetch(`/api/assets?${q}`, { cache: "no-store" });
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
        if (live) setItems(body.items as AssetItemRow[]);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [target, owner, period, demo, demoItems]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const total = (items ?? []).reduce((n, i) => n + i.amount, 0);
  return (
    <div className="asset-drawer-backdrop" onClick={onClose}>
      <aside
        className="asset-drawer"
        role="dialog"
        aria-label={`${target.label} 상세`}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">{periodLabel(target.at)}</span>
            <h2>{target.label}</h2>
            {items && (
              <p className="muted small">
                {items.length}개 항목 · {assetMoney(total)}
              </p>
            )}
          </div>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {error ? (
          <p className="asset-note">{error}</p>
        ) : !items ? (
          <p className="muted">불러오는 중입니다…</p>
        ) : !items.length ? (
          <p className="muted">이 기간에 담긴 항목이 없습니다.</p>
        ) : (
          <ul className="asset-item-list">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {[item.broker, item.owner_name, item.group_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <div className="asset-item-figures">
                  <strong>{assetMoney(item.amount)}</strong>
                  <small>
                    {assetPct(total > 0 ? item.amount / total : null)}
                    {item.quantity !== null &&
                      ` · ${item.quantity.toLocaleString("ko-KR")}주`}
                  </small>
                  {item.profit !== null && (
                    <em className={item.profit >= 0 ? "up" : "down"}>
                      {assetSignedMoney(item.profit)}
                      {item.profit_rate !== null &&
                        ` (${(item.profit_rate * 100).toFixed(2)}%)`}
                    </em>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
