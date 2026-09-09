"use client";
import { useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, Check } from "lucide-react";
import type { CashFile, CashMeta } from "@/lib/cash";
import { cashMoney } from "@/lib/cash";
type Preview = {
  filename: string;
  metadata: CashMeta;
  bytes: number;
  previous: { version: number; metadata: CashMeta } | null;
  expectedVersion: number;
  unchanged: boolean;
};
type Pending = {
  file: File;
  preview?: Preview;
  error?: string;
  done?: boolean;
};
export function CashFiles({
  files,
  onSaved,
  demo,
}: {
  files: CashFile[];
  onSaved: () => void;
  demo: boolean;
}) {
  const [pending, setPending] = useState<Pending[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function send(file: File, preview: boolean, version = 0) {
    const p = new URLSearchParams({
      filename: file.name,
      preview: String(preview),
      version: String(version),
    });
    const r = await fetch(`/api/cash/files?${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    const body = await r.json();
    if (!r.ok)
      throw Error(body.error?.message || "파일을 처리하지 못했습니다.");
    return body as Preview;
  }
  async function select(files: FileList | null) {
    if (!files) return;
    if (files.length > 10) {
      setMessage("한 번에 최대 10개 파일을 선택해주세요.");
      return;
    }
    setMessage("");
    setBusy(true);
    const results: Pending[] = [];
    const seen = new Set<string>();
    for (const file of Array.from(files).slice(0, 10)) {
      const key = file.name.normalize("NFC").trim().toLowerCase();
      if (seen.has(key)) {
        results.push({
          file,
          error: "같은 이름의 파일이 선택에 중복되어 있습니다.",
        });
        continue;
      }
      seen.add(key);
      try {
        if (file.size > 3000000) throw Error("파일당 최대 3MB까지 가능합니다.");
        results.push({ file, preview: await send(file, true) });
      } catch (e) {
        results.push({ file, error: (e as Error).message });
      }
    }
    setPending(results);
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  async function apply() {
    setBusy(true);
    const results = [...pending];
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (!item.preview || item.done) continue;
      try {
        await send(item.file, false, item.preview.expectedVersion);
        results[i] = { ...item, done: true, error: undefined };
      } catch (e) {
        results[i] = { ...item, error: (e as Error).message };
      }
    }
    setPending(results);
    setBusy(false);
    setMessage(
      "파일별 처리 결과를 확인해주세요. 성공한 파일은 즉시 반영됩니다.",
    );
    onSaved();
  }
  return (
    <section className="cash-file-section">
      <div className="panel cash-upload">
        <FileSpreadsheet size={30} />
        <h2>엑셀로 데이터 갱신</h2>
        <p>
          같은 이름의 파일은 최신 내용으로 교체합니다. 이전 파일은 앱에 보관하지
          않습니다.
        </p>
        <p className="muted small">
          이름이 달라지면 별도 자료로 추가됩니다. .xlsx · 파일당 3MB · 한 번에
          최대 10개 · 공간당 20개
        </p>
        <label className={`button primary ${busy ? "disabled" : ""}`}>
          <Upload size={16} />
          {busy ? "파일 확인 중…" : "엑셀 파일 선택"}
          <input
            ref={input}
            className="cash-file-input"
            type="file"
            accept=".xlsx"
            multiple
            disabled={busy || demo}
            aria-label="가계부 엑셀 파일"
            onChange={(e) => void select(e.target.files)}
          />
        </label>
        {demo && (
          <p className="muted">
            샘플 화면입니다. 로그인 후 파일을 업로드할 수 있습니다.
          </p>
        )}
      </div>
      {pending.length > 0 && (
        <div className="panel cash-preview">
          <h2>업로드 미리보기</h2>
          {pending.map((item, i) => (
            <div key={i} className="cash-preview-row">
              <h3>
                {item.file.name.normalize("NFC")}{" "}
                <span className="tag">
                  {item.done
                    ? "반영 완료"
                    : item.preview?.unchanged
                      ? "변경 없음"
                      : item.preview?.previous
                        ? "기존 파일 교체"
                        : "새 파일"}
                </span>
              </h3>
              {item.error && (
                <p role="alert" className="cash-error">
                  {item.error}
                </p>
              )}
              {item.preview && (
                <>
                  <p>
                    {item.preview.metadata.firstDate} ~{" "}
                    {item.preview.metadata.lastDate} ·{" "}
                    {item.preview.metadata.rows.toLocaleString()}행
                  </p>
                  <p className="small">
                    수입 {cashMoney(item.preview.metadata.income)} · 지출{" "}
                    {cashMoney(item.preview.metadata.expense)}{" "}
                    <span className="muted">(원본 기준, 분석 제외 전)</span>
                  </p>
                  {item.preview.previous && (
                    <p className="muted small">
                      이전: {item.preview.previous.metadata.firstDate} ~{" "}
                      {item.preview.previous.metadata.lastDate} ·{" "}
                      {item.preview.previous.metadata.rows.toLocaleString()}행
                    </p>
                  )}
                  {item.preview.previous &&
                    (item.preview.metadata.rows <
                      item.preview.previous.metadata.rows ||
                      item.preview.metadata.firstDate >
                        item.preview.previous.metadata.firstDate ||
                      item.preview.metadata.lastDate <
                        item.preview.previous.metadata.lastDate) && (
                      <p className="cash-notice">
                        저장된 기간 또는 거래 수가 줄어듭니다. 적용하면 과거
                        수정·삭제도 그대로 반영됩니다.
                      </p>
                    )}
                  {item.preview.metadata.sheets > 1 && (
                    <p>
                      첫 번째 시트만 분석합니다. 원본 파일 전체는 그대로
                      저장합니다.
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
          <button
            className="button primary"
            disabled={busy || !pending.some((x) => x.preview && !x.done)}
            onClick={() => void apply()}
          >
            <Check size={16} />
            확인한 파일 적용
          </button>
          <p className="muted small">
            파일별로 적용합니다. 실패한 파일의 기존 내용은 유지됩니다.
          </p>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <div className="section-heading">
        <h2>
          저장된 원본 <span>{files.length}</span>
        </h2>
      </div>
      <div className="cash-file-grid">
        {files.map((file) => (
          <article className="panel cash-file-card" key={file.id}>
            <div className="cash-file-title">
              <FileSpreadsheet size={22} />
              <h3>{file.filename}</h3>
            </div>
            <dl>
              <div>
                <dt>기록 범위</dt>
                <dd>
                  {file.metadata.firstDate} ~ {file.metadata.lastDate}
                </dd>
              </div>
              <div>
                <dt>원본 거래</dt>
                <dd>
                  {file.metadata.rows.toLocaleString()}행 ·{" "}
                  {(file.bytes / 1024).toFixed(0)}KB
                </dd>
              </div>
              <div>
                <dt>거래 유형</dt>
                <dd>
                  수입 {file.metadata.incomeRows.toLocaleString()} · 지출{" "}
                  {file.metadata.expenseRows.toLocaleString()} · 이체/차액{" "}
                  {file.metadata.otherRows.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>최근 업로드</dt>
                <dd>
                  {new Date(file.updated_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </dd>
              </div>
            </dl>
            {file.metadata.negativeRows > 0 && (
              <p className="small muted">
                음수 {file.metadata.negativeRows}건의 부호를 보존합니다.
              </p>
            )}
            {!demo && (
              <a
                className="button secondary"
                href={`/api/cash/files?id=${file.id}`}
              >
                <Download size={14} />
                원본 다운로드
              </a>
            )}
            {!file.canEdit && (
              <p className="small muted">
                교체는 업로드한 사람 또는 관리자에게 요청해주세요.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
