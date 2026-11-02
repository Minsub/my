"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { Operation } from "@/lib/contracts";
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "url"
    | "date"
    | "email"
    | "textarea"
    | "select"
    | "rows";
  options?: { value: string; label: string }[];
  // type "rows": 숫자 칸 묶음을 여러 줄 입력한다. 값은 줄마다 {칸 이름: 숫자|null} 배열로 넘긴다.
  columns?: { name: string; label: string }[];
  rows?: Record<string, number | null>[];
  required?: boolean;
  value?: string | number | null;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
};
export type FormSpec = {
  title: string;
  description?: string;
  operation: Operation;
  fields: Field[];
  extra?: Record<string, unknown>;
  transform?: (values: Record<string, unknown>) => Record<string, unknown>;
  submitLabel?: string;
};
export function RecordForm({
  spec,
  onClose,
  onSave,
}: {
  spec: FormSpec;
  onClose: () => void;
  onSave: (op: Operation, input: Record<string, unknown>) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    key = useRef(crypto.randomUUID());
  const submitted = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="record-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      aria-labelledby="form-title"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const fd = new FormData(e.currentTarget);
          let input: Record<string, unknown> = {
            ...spec.extra,
            idempotency_key: key.current,
          };
          for (const f of spec.fields) {
            if (f.type === "rows") {
              input[f.name] = readRows(fd, f);
              continue;
            }
            const value = String(fd.get(f.name) ?? "");
            input[f.name] =
              f.type === "number"
                ? value === ""
                  ? null
                  : Number(value)
                : value;
          }
          // transform이 입력 확인에 실패하면 던진 메시지를 폼 오류로 보여준다.
          try {
            if (spec.transform) input = spec.transform(input);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "입력을 확인해주세요.",
            );
            return;
          }
          const fingerprint = JSON.stringify({
            ...input,
            idempotency_key: undefined,
          });
          if (submitted.current && submitted.current !== fingerprint) {
            key.current = crypto.randomUUID();
            input.idempotency_key = key.current;
          }
          submitted.current = fingerprint;
          setBusy(true);
          try {
            await onSave(spec.operation, input);
            onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "저장하지 못했습니다.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ADD TO YOUR COLLECTION</span>
            <h2 id="form-title">{spec.title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {spec.description && <p className="muted">{spec.description}</p>}
        <div className="form-fields">
          {spec.fields.map((f) =>
            f.type === "rows" ? (
              <RowsField field={f} key={f.name} />
            ) : (
              <label
                className={f.type === "textarea" ? "field field-wide" : "field"}
                key={f.name}
              >
                <span>
                  {f.label}
                  {f.required && <em> *</em>}
                </span>
                {f.type === "select" ? (
                  <select
                    name={f.name}
                    aria-label={f.label}
                    defaultValue={String(f.value ?? "")}
                    required={f.required}
                  >
                    {!f.required && <option value="">미입력</option>}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    aria-label={f.label}
                    rows={3}
                    defaultValue={String(f.value ?? "")}
                    maxLength={5000}
                  />
                ) : (
                  <input
                    name={f.name}
                    aria-label={f.label}
                    type={f.type ?? "text"}
                    defaultValue={f.value ?? ""}
                    required={f.required}
                    min={f.min ?? 0}
                    max={f.max}
                    step={f.step ?? "1"}
                    maxLength={f.type === "url" ? 2000 : 200}
                  />
                )}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ),
          )}
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <>
                {spec.submitLabel ?? "저장하기"} <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const rowName = (f: Field, row: number, col: string) =>
  `${f.name}.${row}.${col}`;
function readRows(fd: FormData, f: Field) {
  const count = Number(fd.get(`${f.name}.count`) ?? 0);
  const rows: Record<string, number | null>[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, number | null> = {};
    for (const c of f.columns ?? []) {
      const value = String(fd.get(rowName(f, i, c.name)) ?? "");
      row[c.name] = value === "" ? null : Number(value);
    }
    rows.push(row);
  }
  return rows;
}
function RowsField({ field: f }: { field: Field }) {
  // 줄을 지워도 다른 줄의 입력값이 섞이지 않도록 줄마다 고정 key를 둔다.
  const [rows, setRows] = useState(() =>
    (f.rows?.length ? f.rows : [{}]).map((value) => ({
      key: crypto.randomUUID(),
      value,
    })),
  );
  const max = f.max ?? 10;
  return (
    <fieldset className="field field-wide rows-field">
      <legend>{f.label}</legend>
      <input type="hidden" name={`${f.name}.count`} value={rows.length} />
      {rows.map((row, i) => (
        <div className="rows-field-row" key={row.key}>
          {f.columns?.map((c) => (
            <label key={c.name}>
              <span>{c.label}</span>
              <input
                name={rowName(f, i, c.name)}
                aria-label={`${f.label} ${i + 1} ${c.label}`}
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                defaultValue={row.value[c.name] ?? ""}
              />
            </label>
          ))}
          <button
            type="button"
            className="icon-button"
            aria-label={`${f.label} ${i + 1} 지우기`}
            disabled={rows.length === 1}
            onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setRows([...rows, { key: crypto.randomUUID(), value: {} }])
          }
        >
          <Plus size={14} />줄 추가
        </button>
      )}
      {f.hint && <small>{f.hint}</small>}
    </fieldset>
  );
}
