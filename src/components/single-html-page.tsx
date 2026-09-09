"use client";
import { useEffect, useRef, useState } from "react";
import type { CashFile } from "@/lib/cash";
type Package = { html: string; files: { name: string; bytes: ArrayBuffer }[] };
async function loadPackage(
  pageId: string,
  withFiles: boolean,
): Promise<Package> {
  const [page, list] = await Promise.all([
    fetch(`/api/html-pages/${encodeURIComponent(pageId)}`, {
      cache: "no-store",
    }),
    withFiles
      ? fetch("/api/cash/files", { cache: "no-store" })
      : Promise.resolve(Response.json({ files: [] })),
  ]);
  if (!page.ok || !list.ok)
    throw Error("페이지를 불러오지 못했습니다. 로그인 상태를 확인해주세요.");
  const [{ html }, { files }] = await Promise.all([page.json(), list.json()]);
  const originals = [];
  for (const file of files as CashFile[]) {
    const r = await fetch(`/api/cash/files?id=${encodeURIComponent(file.id)}`, {
      cache: "no-store",
    });
    if (!r.ok)
      throw Error(`${file.filename}을 읽지 못했습니다. 새로고침해주세요.`);
    originals.push({ name: file.filename, bytes: await r.arrayBuffer() });
  }
  return { html, files: originals };
}
type Props = { pageId: string; title: string; dataSource?: "cash" | "none" };
export function SingleHtmlPage(props: Props) {
  return (
    <HtmlPage key={props.pageId + (props.dataSource || "none")} {...props} />
  );
}
function HtmlPage({ pageId, title, dataSource = "none" }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<Promise<Package> | null>(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    let active = true,
      sent = false;
    // The same mount shares its load in Strict Mode; no private file cache survives navigation.
    pending.current ||= loadPackage(pageId, dataSource === "cash");
    const work = pending.current;
    async function receive(event: MessageEvent) {
      if (
        !active ||
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      if (event.data?.type === "mono:cash-ready" && !sent) {
        sent = true;
        try {
          const payload = await work;
          if (active)
            frame.current?.contentWindow?.postMessage(
              { type: "mono:cash-files", files: payload.files },
              "*",
            );
        } catch {
          /* Initial load reports the error. */
        }
      }
      if (event.data?.type === "mono:cash-loaded") setLoaded(true);
      if (event.data?.type === "mono:cash-error")
        setError("원본 HTML이 엑셀을 읽지 못했습니다.");
    }
    window.addEventListener("message", receive);
    void work
      .then((value) => {
        if (active) {
          setEmpty(dataSource === "cash" && !value.files.length);
          setHtml(value.html);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
      window.removeEventListener("message", receive);
    };
  }, [pageId, dataSource]);
  return error ? (
    <div role="alert" className="cash-error">
      {error}
      <button onClick={() => window.location.reload()}>다시 불러오기</button>
    </div>
  ) : empty ? (
    <p className="cash-empty">파일 관리에서 엑셀을 먼저 올려주세요.</p>
  ) : (
    <>
      {!loaded && <p role="status">HTML 페이지와 자료를 준비하고 있습니다…</p>}
      {html && (
        <iframe
          ref={frame}
          title={title}
          className="cash-html-frame"
          sandbox="allow-scripts allow-downloads"
          srcDoc={html}
          onLoad={() => {
            if (dataSource === "none") setLoaded(true);
          }}
        />
      )}
    </>
  );
}
