"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  assetGroups,
  assetMoney,
  assetPct,
  assetSignedMoney,
  assetGroupName,
  assetItemsCsv,
} from "@/lib/assets";
import type { AssetItemRow, AssetSnapshotRow } from "@/server/assets";
import type { Operation } from "@/lib/contracts";
import { dateLabel } from "@/lib/format";
import { demoAssetHistory } from "@/lib/demo-assets";
type History = {
  snapshots: AssetSnapshotRow[];
  selected: { snapshot: AssetSnapshotRow; items: AssetItemRow[] } | null;
};
export function AssetRecords({
  initialQuery,
  demo = false,
  href = (p: string) => p,
}: {
  initialQuery: Record<string, string>;
  demo?: boolean;
  href?: (path: string) => string;
}) {
  const [selected, setSelected] = useState(initialQuery.snapshot ?? "");
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState("");
  // 수정 중인 한 줄. 표 전체를 편집 모드로 바꾸지 않는다. 고치려는 줄은 보통 한 줄이다.
  const [editing, setEditing] = useState<{
    id: string;
    group_key: string;
    amount: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        if (demo) {
          if (live) setData(demoAssetHistory(selected));
          return;
        }
        const q = new URLSearchParams({ view: "history" });
        if (selected) q.set("snapshot", selected);
        const r = await fetch(`/api/assets?${q}`, { cache: "no-store" });
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.message ?? "불러오지 못했습니다.");
        if (live) {
          setData(body as History);
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [selected, revision, demo]);
  const inform = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 5000);
  };
  // 바뀐 값만 보낸다. 서버는 보내지 않은 항목을 그대로 둔다.
  async function saveItem(snapshot: AssetSnapshotRow, item: AssetItemRow) {
    if (!editing || demo) return;
    const amount = Number(editing.amount);
    if (!Number.isInteger(amount) || amount < 1) {
      inform("금액은 1원 이상 정수로 입력해주세요.");
      return;
    }
    const changes: Record<string, unknown> = {};
    if (editing.group_key !== item.group_key)
      changes.group_key = editing.group_key;
    if (amount !== item.amount) changes.amount = amount;
    if (!Object.keys(changes).length) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "asset_update_item" satisfies Operation,
          input: {
            snapshot_id: snapshot.id,
            item_id: item.id,
            expected_version: snapshot.version,
            ...changes,
            idempotency_key: crypto.randomUUID(),
          },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message ?? "수정하지 못했습니다.");
      setEditing(null);
      setRevision((n) => n + 1);
      inform(`${item.name} 항목을 수정했습니다.`);
    } catch (e) {
      inform((e as Error).message);
      // 버전 충돌이면 화면이 낡은 것이다. 다시 불러와 최신 값 위에서 고치게 한다.
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: AssetSnapshotRow) {
    if (demo) return;
    if (
      !window.confirm(
        `${row.owner_name} ${row.as_of} 기록을 삭제할까요? 되돌릴 수 없습니다.`,
      )
    )
      return;
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "asset_delete_snapshot" satisfies Operation,
        input: { id: row.id, idempotency_key: crypto.randomUUID() },
      }),
    });
    const body = await r.json();
    if (!r.ok) {
      inform(body.error?.message ?? "삭제하지 못했습니다.");
      return;
    }
    if (row.id === selected) setSelected("");
    setRevision((n) => n + 1);
  }
  async function exportCsv() {
    try {
      const csv = demo
        ? assetItemsCsv(
            demoAssetHistory("").snapshots.flatMap(
              (s) => demoAssetHistory(s.id).selected?.items ?? [],
            ),
          )
        : await (async () => {
            const r = await fetch("/api/assets?view=export", {
              cache: "no-store",
            });
            if (!r.ok) throw Error("내보내지 못했습니다.");
            return r.text();
          })();
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "자산기록.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      inform((e as Error).message);
    }
  }
  // CSV 내보내기는 오류·로딩 화면에서도 누를 수 있다. 토스트를 모든 반환 경로에 붙인다.
  const overlays = toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
  const heading = (
    <div className="page-heading">
      <div>
        <span className="eyebrow">ASSETS / RECORDS</span>
        <h1>
          기록 이력<span className="heading-dot">.</span>
        </h1>
        <p>등록한 자산 기록과 그때 저장한 원본 항목을 그대로 봅니다.</p>
      </div>
      <div className="button-row">
        <button className="button secondary" onClick={exportCsv}>
          <Download size={15} /> CSV 내보내기
        </button>
        <Link className="button secondary" href={href("/assets/status")}>
          <ArrowLeft size={15} /> 자산현황
        </Link>
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
  if (!data)
    return (
      <div className="asset-page">
        {heading}
        <p className="muted">불러오는 중입니다…</p>
        {overlays}
      </div>
    );
  if (!data.snapshots.length)
    return (
      <div className="asset-page">
        {heading}
        <div className="empty-state">
          <div className="empty-icon">
            <RefreshCw size={30} />
          </div>
          <h3>아직 등록된 기록이 없습니다</h3>
          <p>자산현황에서 기록을 추가하면 여기에 이력이 쌓입니다.</p>
        </div>
        {overlays}
      </div>
    );
  const detail = data.selected;
  const total = detail?.items.reduce((n, i) => n + i.amount, 0) ?? 0;
  // 삭제와 같은 규칙이다. 등록한 사람 또는 관리자만 고칠 수 있고 둘러보기에서는 저장하지 않는다.
  const canEditItems = Boolean(detail?.snapshot.canEdit) && !demo;
  return (
    <div className="asset-page asset-records">
      {heading}
      <div className="asset-records-grid">
        <section className="panel">
          <div className="section-heading compact">
            <h2>등록 이력</h2>
            <span className="muted small">{data.snapshots.length}건</span>
          </div>
          <ul className="asset-record-list">
            {data.snapshots.map((s) => (
              <li
                key={s.id}
                className={detail?.snapshot.id === s.id ? "selected" : ""}
              >
                <button
                  onClick={() => {
                    // 다른 기록을 고르면 편집 중이던 줄은 더 이상 그 화면에 없다.
                    setEditing(null);
                    setSelected(s.id);
                  }}
                >
                  <strong>{dateLabel(s.as_of)}</strong>
                  <span>{s.owner_name}</span>
                  <em>{assetMoney(s.total)}</em>
                  <small>
                    {s.item_count}개 항목 ·{" "}
                    {s.source === "mcp" ? "AI로 기록" : "직접 기록"} · v
                    {s.version}
                  </small>
                </button>
                {s.canEdit && !demo && (
                  <button
                    className="icon-button"
                    aria-label={`${s.owner_name} ${s.as_of} 기록 삭제`}
                    onClick={() => remove(s)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          {detail && (
            <>
              <div className="section-heading compact">
                <h2>
                  {dateLabel(detail.snapshot.as_of)}{" "}
                  {detail.snapshot.owner_name}
                </h2>
                <span className="muted small">
                  원본 {detail.items.length}건 · {assetMoney(total)}
                </span>
              </div>
              {detail.snapshot.note && (
                <p className="asset-note">{detail.snapshot.note}</p>
              )}
              {canEditItems && (
                <p className="asset-note">
                  연필 버튼으로 한 줄의 자산그룹·금액을 고칠 수 있습니다. 이름·
                  수량·수익은 원본 그대로 두며, 그 날짜 전체를 바꾸려면
                  자산현황에서 다시 기록합니다.
                </p>
              )}
              <div className="asset-table-scroll">
                <table className="asset-table asset-raw-table">
                  <thead>
                    <tr>
                      <th scope="col">투자 이름</th>
                      <th scope="col">증권사</th>
                      <th scope="col">자산그룹</th>
                      <th scope="col">금액</th>
                      <th scope="col">비중</th>
                      <th scope="col">수량</th>
                      <th scope="col">수익금</th>
                      <th scope="col">수익률</th>
                      {canEditItems && <th scope="col" aria-label="수정" />}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => {
                      const edit = editing?.id === item.id ? editing : null;
                      return (
                        <tr key={item.id} className={edit ? "editing" : ""}>
                          <th scope="row">{item.name}</th>
                          <td>{item.broker || "—"}</td>
                          <td>
                            {edit ? (
                              <select
                                className="asset-edit-select"
                                aria-label={`${item.name} 자산그룹`}
                                value={edit.group_key}
                                disabled={busy}
                                onChange={(e) =>
                                  setEditing({
                                    ...edit,
                                    group_key: e.target.value,
                                  })
                                }
                              >
                                {assetGroups.map((g) => (
                                  <option key={g.key} value={g.key}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              assetGroupName(item.group_key)
                            )}
                          </td>
                          <td>
                            {edit ? (
                              <input
                                className="asset-edit-amount"
                                type="number"
                                min={1}
                                step={1}
                                aria-label={`${item.name} 금액`}
                                value={edit.amount}
                                disabled={busy}
                                autoFocus
                                onChange={(e) =>
                                  setEditing({
                                    ...edit,
                                    amount: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    saveItem(detail.snapshot, item);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                            ) : (
                              assetMoney(item.amount)
                            )}
                          </td>
                          <td>
                            {assetPct(total > 0 ? item.amount / total : null)}
                          </td>
                          <td>
                            {item.quantity === null
                              ? "—"
                              : item.quantity.toLocaleString("ko-KR")}
                          </td>
                          <td
                            className={
                              item.profit === null
                                ? ""
                                : item.profit >= 0
                                  ? "up"
                                  : "down"
                            }
                          >
                            {assetSignedMoney(item.profit)}
                          </td>
                          <td
                            className={
                              item.profit_rate === null
                                ? ""
                                : item.profit_rate >= 0
                                  ? "up"
                                  : "down"
                            }
                          >
                            {item.profit_rate === null
                              ? "—"
                              : `${(item.profit_rate * 100).toFixed(2)}%`}
                          </td>
                          {canEditItems && (
                            <td>
                              <div className="asset-row-actions">
                                {edit ? (
                                  <>
                                    <button
                                      className="icon-button"
                                      aria-label={`${item.name} 수정 저장`}
                                      disabled={busy}
                                      onClick={() =>
                                        saveItem(detail.snapshot, item)
                                      }
                                    >
                                      <Check size={15} />
                                    </button>
                                    <button
                                      className="icon-button"
                                      aria-label={`${item.name} 수정 취소`}
                                      disabled={busy}
                                      onClick={() => setEditing(null)}
                                    >
                                      <X size={15} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="icon-button"
                                    aria-label={`${item.name} 자산그룹·금액 수정`}
                                    onClick={() =>
                                      setEditing({
                                        id: item.id,
                                        group_key: item.group_key,
                                        amount: String(item.amount),
                                      })
                                    }
                                  >
                                    <Pencil size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
      {overlays}
    </div>
  );
}
