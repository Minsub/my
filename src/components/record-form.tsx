"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, LoaderCircle } from "lucide-react";
import type { Operation } from "@/lib/contracts";
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "url" | "date" | "email" | "textarea" | "select";
  options?: { value: string; label: string }[];
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
            const value = String(fd.get(f.name) ?? "");
            input[f.name] =
              f.type === "number"
                ? value === ""
                  ? null
                  : Number(value)
                : value;
          }
          if (spec.transform) input = spec.transform(input);
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
          {spec.fields.map((f) => (
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
          ))}
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
                저장하기 <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
