"use client";

import Link from "next/link";
import { FileCode2 } from "lucide-react";
import { htmlPages, type HtmlPageInfo } from "@/lib/html-pages";
import { SingleHtmlPage } from "./single-html-page";

export function HtmlPageList({ href }: { href: (path: string) => string }) {
  return (
    <div className="html-pages">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ETC / HTML</span>
          <h1>
            HTML 도구<span className="heading-dot">.</span>
          </h1>
          <p>별도로 만든 단일 HTML을 그대로 등록해 사용하는 도구 목록입니다.</p>
        </div>
      </header>
      <section className="html-page-list" aria-label="등록된 HTML 도구">
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
