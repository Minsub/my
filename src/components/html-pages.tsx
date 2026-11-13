"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileCode2, FileUp, Pencil, Trash2, Upload } from "lucide-react";
import {
  htmlPages,
  HTML_UPLOAD_MAX_BYTES,
  type HtmlPageInfo,
  type HtmlUpload,
} from "@/lib/html-pages";
import { SingleHtmlPage } from "./single-html-page";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(body.error?.message || "요청을 처리하지 못했습니다.");
  return body as T;
}
const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
const when = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  });
function guessTitle(html: string, filename: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = title
    ?.replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (text || filename.replace(/\.html?$/i, "")).slice(0, 80);
}
// sandbox CSP는 외부 스크립트·스타일·이미지·fetch를 막는다. 올리기 전에 알려준다.
const external = (html: string) =>
  /<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i.test(
    html,
  ) || /\bfetch\s*\(\s*["'`]https?:/i.test(html);

function HtmlUploadForm({
  existing,
  onDone,
  onCancel,
}: {
  existing?: HtmlUpload;
  onDone: (page: HtmlUpload) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<{ name: string; html: string } | null>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function pick(selected: File | undefined) {
    setError("");
    if (!selected) return setFile(null);
    if (selected.size > HTML_UPLOAD_MAX_BYTES) {
      setFile(null);
      return setError("HTML은 3MB까지 올릴 수 있습니다.");
    }
    const html = await selected.text();
    setFile({ name: selected.name, html });
    if (!existing && !title.trim()) setTitle(guessTitle(html, selected.name));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!existing && !file) return setError("HTML 파일을 골라주세요.");
    setBusy(true);
    setError("");
    try {
      const body = {
        title,
        description,
        ...(file ? { filename: file.name, html: file.html } : {}),
        ...(existing ? { expected_version: existing.version } : {}),
      };
      const { page } = await api<{ page: HtmlUpload }>(
        existing ? `/api/html-uploads/${existing.id}` : "/api/html-uploads",
        { method: existing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      onDone(page);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="panel html-upload-form" onSubmit={(e) => void submit(e)}>
      <h2>{existing ? "HTML 바꾸기" : "HTML 올리기"}</h2>
      <div className="form-fields">
        <label className="field field-wide">
          <span>
            HTML 파일 {existing && <em>비워 두면 지금 파일을 유지합니다</em>}
          </span>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <small>
            CSS·JS가 파일 안에 들어 있는 단일 HTML · 3MB까지
            {existing && ` · 지금: ${existing.filename}`}
          </small>
        </label>
        <label className="field field-wide">
          <span>제목</span>
          <input
            value={title}
            maxLength={80}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field field-wide">
          <span>설명</span>
          <input
            value={description}
            maxLength={200}
            placeholder="목록에 보일 한 줄"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>
      {file && external(file.html) && (
        <p className="html-upload-warning">
          외부 주소의 스크립트·스타일·이미지·요청이 보입니다. 앱 안에서는
          막히므로 그 부분은 동작하지 않을 수 있습니다.
        </p>
      )}
      {error && (
        <p role="alert" className="html-upload-error">
          {error}
        </p>
      )}
      <div className="button-row">
        <button className="button primary" disabled={busy}>
          <Upload size={15} />
          {busy ? "저장 중…" : existing ? "저장" : "올리기"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          취소
        </button>
      </div>
    </form>
  );
}

function UploadedCard({
  page,
  href,
  onEdit,
  onDeleted,
}: {
  page: HtmlUpload;
  href: (path: string) => string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    try {
      await api(`/api/html-uploads/${page.id}`, {
        method: "DELETE",
        body: JSON.stringify({ expected_version: page.version }),
      });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article className="html-page-card html-upload-card">
      <Link className="html-upload-link" href={href(`/etc/html/${page.id}`)}>
        <FileUp size={24} />
        <div>
          <h2>{page.title}</h2>
          {page.description && <p>{page.description}</p>}
          <code>
            {page.filename} · {kb(page.bytes)} · {when(page.updated_at)}
          </code>
        </div>
      </Link>
      {page.canEdit && (
        <div className="html-upload-actions">
          {confirming ? (
            <>
              <span>삭제할까요?</span>
              <button
                className="text-button danger"
                onClick={() => void remove()}
              >
                삭제
              </button>
              <button
                className="text-button"
                onClick={() => setConfirming(false)}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button className="text-button" onClick={onEdit}>
                <Pencil size={13} />
                바꾸기
              </button>
              <button
                className="text-button danger"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={13} />
                삭제
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="html-upload-error">
          {error}
        </p>
      )}
    </article>
  );
}

function UploadedSection({
  href,
  demo,
}: {
  href: (path: string) => string;
  demo: boolean;
}) {
  const [pages, setPages] = useState<HtmlUpload[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<HtmlUpload | "new" | null>(null);
  const [round, setRound] = useState(0);
  const load = () => setRound((n) => n + 1);
  useEffect(() => {
    if (demo) return;
    let live = true;
    api<{ pages: HtmlUpload[] }>("/api/html-uploads")
      .then(({ pages }) => live && setPages(pages))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [demo, round]);
  return (
    <section className="html-upload-section" aria-label="올린 HTML">
      <div className="section-heading">
        <h2>
          올린 HTML <span>{pages?.length ?? 0}</span>
        </h2>
        {!demo && editing === null && (
          <button
            className="button primary small-button"
            onClick={() => setEditing("new")}
          >
            <Upload size={14} />
            HTML 올리기
          </button>
        )}
      </div>
      {editing !== null && (
        <HtmlUploadForm
          key={editing === "new" ? "new" : editing.id}
          existing={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {demo ? (
        <p className="html-page-notice">
          로그인하면 직접 만든 HTML을 올려 바로 열 수 있습니다.
        </p>
      ) : error ? (
        <p role="alert" className="html-upload-error">
          {error}
        </p>
      ) : pages === null ? (
        <p role="status" className="muted">
          불러오는 중…
        </p>
      ) : pages.length ? (
        <div className="html-page-list">
          {pages.map((page) => (
            <UploadedCard
              key={page.id}
              page={page}
              href={href}
              onEdit={() => setEditing(page)}
              onDeleted={() => void load()}
            />
          ))}
        </div>
      ) : (
        <p className="html-page-notice">
          아직 올린 HTML이 없습니다. 배포 없이 HTML 파일 하나를 올리면 이
          목록에서 바로 열 수 있습니다.
        </p>
      )}
    </section>
  );
}

export function HtmlPageList({
  href,
  demo = false,
}: {
  href: (path: string) => string;
  demo?: boolean;
}) {
  return (
    <div className="html-pages">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ETC / HTML</span>
          <h1>
            HTML 도구<span className="heading-dot">.</span>
          </h1>
          <p>
            직접 만든 단일 HTML을 올리거나 등록해 앱 안에서 여는 도구
            목록입니다.
          </p>
        </div>
      </header>
      <UploadedSection href={href} demo={demo} />
      <section className="html-builtin-section" aria-label="등록된 HTML 도구">
        <div className="section-heading">
          <h2>
            기본 도구 <span>{htmlPages.length}</span>
          </h2>
        </div>
        <div className="html-page-list">
          {htmlPages.map((page) => (
            <Link
              className="html-page-card"
              href={href(`/etc/html/${page.id}`)}
              key={page.id}
            >
              <FileCode2 size={24} />
              <div>
                <h2>{page.title}</h2>
                <p>{page.description}</p>
                <code>src/html/{page.filename}</code>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function HtmlPageView({
  page,
  href,
  demo = false,
}: {
  page: HtmlPageInfo;
  href: (path: string) => string;
  demo?: boolean;
}) {
  return (
    <div className="html-pages html-page-view">
      <header className="html-page-heading">
        <div>
          <span className="eyebrow">ETC / HTML</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <Link className="button secondary" href={href("/etc/html")}>
          HTML 목록
        </Link>
      </header>
      <p className="html-page-source">원본: src/html/{page.filename}</p>
      {demo ? (
        <p className="html-page-notice">
          등록된 HTML 도구는 로그인 후 사용할 수 있습니다.
        </p>
      ) : (
        <SingleHtmlPage pageId={page.id} title={page.title} />
      )}
    </div>
  );
}

export function UploadedHtmlView({
  id,
  href,
  demo = false,
}: {
  id: string;
  href: (path: string) => string;
  demo?: boolean;
}) {
  const [state, setState] = useState<{ page: HtmlUpload; html: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [round, setRound] = useState(0);
  const load = () => setRound((n) => n + 1);
  useEffect(() => {
    if (demo) return;
    let live = true;
    api<{ page: HtmlUpload; html: string }>(`/api/html-uploads/${id}`)
      .then((value) => live && setState(value))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [demo, id, round]);
  const page = state?.page;
  return (
    <div className="html-pages html-page-view">
      <header className="html-page-heading">
        <div>
          <span className="eyebrow">ETC / HTML</span>
          <h1>{page?.title ?? "올린 HTML"}</h1>
          {page?.description && <p>{page.description}</p>}
        </div>
        {page?.canEdit && !editing && (
          <button
            className="button secondary html-upload-edit"
            onClick={() => setEditing(true)}
          >
            바꾸기
          </button>
        )}
        <Link className="button secondary" href={href("/etc/html")}>
          HTML 목록
        </Link>
      </header>
      {page && (
        <p className="html-page-source">
          올린 파일: {page.filename} · {kb(page.bytes)} ·{" "}
          {when(page.updated_at)}
        </p>
      )}
      {page && editing && (
        <HtmlUploadForm
          existing={page}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            load();
          }}
        />
      )}
      {demo ? (
        <p className="html-page-notice">
          올린 HTML은 로그인 후 사용할 수 있습니다.
        </p>
      ) : error ? (
        <p role="alert" className="html-upload-error">
          {error}
        </p>
      ) : state ? (
        <SingleHtmlPage
          key={state.page.version}
          pageId={`upload:${state.page.id}`}
          title={state.page.title}
          html={state.html}
        />
      ) : (
        <p role="status">HTML을 불러오고 있습니다…</p>
      )}
    </div>
  );
}
