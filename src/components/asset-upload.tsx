"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, X, TriangleAlert, LoaderCircle } from "lucide-react";
import {
  assetCompact,
  assetCsvColumns,
  assetGroupName,
  assetMoney,
  parseAssetCsv,
  type AssetCsvParse,
} from "@/lib/assets";
import { today } from "@/lib/format";
import type { AssetOwner } from "@/lib/assets";
import type { Operation } from "@/lib/contracts";
// 자산 목록은 수십 줄이라 화면에서 한 칸씩 넣을 것이 아니다. CSV 한 장을 올린다.
// 잘못된 파일을 절반만 저장하면 그 날짜가 통째로 망가지므로, 한 줄이라도 문제가 있으면 저장하지 않는다.
export function AssetUpload({
  owners,
  defaultOwner,
  onClose,
  onSave,
}: {
  owners: AssetOwner[];
  defaultOwner: string;
  onClose: () => void;
  onSave: (
    operation: Operation,
    input: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const [ownerId, setOwnerId] = useState(defaultOwner);
  const [asOf, setAsOf] = useState(today());
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<AssetCsvParse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showColumns, setShowColumns] = useState(false);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  const ownerName = owners.find((o) => o.id === ownerId)?.name ?? "";
  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const text = await file.text();
    const result = parseAssetCsv(text);
    setParsed(result);
    // 파일이 기준일을 들고 있으면 그대로 쓴다. 사람이 다시 고르게 하면 틀린 날짜로 저장된다.
    if (result.as_of) setAsOf(result.as_of);
  }
  // CSV의 기준일·구성원은 화면에서 고른 값과 같아야 한다. 다른 사람 파일을 잘못 올리는 것을 막는다.
  const mismatch: string[] = [];
  if (parsed?.as_of && parsed.as_of !== asOf)
    mismatch.push(`CSV의 기준일은 ${parsed.as_of}인데 ${asOf}로 저장합니다.`);
  if (parsed?.owner && ownerName && parsed.owner !== ownerName)
    mismatch.push(
      `CSV의 구성원은 "${parsed.owner}"인데 "${ownerName}"으로 저장합니다.`,
    );
  const issues = [...(parsed?.issues ?? [])];
  const ready =
    Boolean(parsed?.items.length) && !issues.length && !mismatch.length;
  const byGroup = new Map<string, number>();
  for (const item of parsed?.items ?? [])
    byGroup.set(
      item.group_key,
      (byGroup.get(item.group_key) ?? 0) + item.amount,
    );
  async function submit() {
    if (!ready || !parsed || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave("asset_record_snapshot", {
        idempotency_key: key.current,
        owner_id: ownerId,
        as_of: asOf,
        expected_version: null,
        note,
        items: parsed.items,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      // 같은 키로 다시 보내면 서버가 첫 시도의 결과를 돌려준다. 고쳐서 다시 올리는 것은 새 작업이다.
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
      aria-label="자산 기록 업로드"
    >
      <div className="asset-upload-body">
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">ASSETS / IMPORT</span>
            <h2>자산 기록</h2>
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
        <p className="muted small">
          한 사람의 그 날짜 자산 전체를 CSV 한 장으로 올립니다. 같은 사람·같은
          날짜로 다시 올리면 그 날짜를 통째로 교체합니다.
        </p>
        <div className="asset-upload-fields">
          <label className="field">
            <span>소유자</span>
            <select
              value={ownerId}
              disabled={busy}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>기준일</span>
            <input
              type="date"
              value={asOf}
              disabled={busy}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
          <label className="field field-wide">
            <span>메모</span>
            <input
              value={note}
              disabled={busy}
              placeholder="어디서 뽑은 자료인지 등"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        <label className="asset-drop">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Upload size={18} />
          <span>{fileName || "CSV 파일 선택"}</span>
        </label>
        <button
          className="asset-columns-toggle"
          aria-expanded={showColumns}
          onClick={() => setShowColumns(!showColumns)}
        >
          CSV 열 규격 {showColumns ? "닫기" : "보기"}
        </button>
        {showColumns && (
          <div className="asset-columns">
            <p className="muted small">
              첫 줄이 열 이름이고 순서는 자유입니다. 목록에 없는 열이 하나라도
              있으면 올리지 않습니다. AI에게는{" "}
              <code>asset_get_classification_rules</code>의{" "}
              <code>csv_contract</code>를 따르라고 하면 같은 규격이 나옵니다.
            </p>
            <table className="asset-table">
              <thead>
                <tr>
                  <th scope="col">열 이름</th>
                  <th scope="col">필수</th>
                  <th scope="col">설명</th>
                </tr>
              </thead>
              <tbody>
                {assetCsvColumns.map((column) => (
                  <tr key={column.name}>
                    <th scope="row">{column.name}</th>
                    <td>{column.required ? "필수" : "선택"}</td>
                    <td className="asset-column-help">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {parsed && (issues.length > 0 || mismatch.length > 0) && (
          <div className="asset-upload-issues" role="alert">
            <p>
              <TriangleAlert size={15} />
              {issues.length
                ? `고쳐야 할 곳이 ${issues.length}군데 있습니다. 한 줄이라도 문제가 있으면 저장하지 않습니다.`
                : "확인이 필요합니다."}
            </p>
            <ul>
              {mismatch.map((text) => (
                <li key={text}>{text}</li>
              ))}
              {issues.slice(0, 30).map((issue, i) => (
                <li key={i}>
                  {issue.line !== null && <b>{issue.line}번째 줄</b>}
                  {issue.message}
                </li>
              ))}
            </ul>
            {issues.length > 30 && (
              <p className="muted small">
                이 밖에 {issues.length - 30}군데가 더 있습니다.
              </p>
            )}
          </div>
        )}
        {parsed && ready && (
          <div className="asset-upload-preview">
            <div className="asset-upload-sum">
              <span>{parsed.items.length}개 항목</span>
              <strong>{assetMoney(parsed.total)}</strong>
            </div>
            <ul>
              {[...byGroup]
                .sort((a, b) => b[1] - a[1])
                .map(([groupKey, amount]) => (
                  <li key={groupKey}>
                    <span>{assetGroupName(groupKey)}</span>
                    <b>{assetCompact(amount)}</b>
                  </li>
                ))}
            </ul>
          </div>
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
            disabled={!ready || busy}
            onClick={submit}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            {parsed && ready ? `${parsed.items.length}개 항목 저장` : "저장"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
