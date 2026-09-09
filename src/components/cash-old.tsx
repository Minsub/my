"use client";
import Link from "next/link";
import { SingleHtmlPage } from "./single-html-page";
export function CashOld({ demo = false }: { demo?: boolean }) {
  return (
    <div className="cash-page cash-old-page">
      <header className="cash-old-heading">
        <div>
          <h1>가계부(old)</h1>
          <p>원본 HTML · 저장된 엑셀로 자동 연결</p>
        </div>
        <Link
          className="button secondary"
          href={demo ? "/demo?view=/cash" : "/cash"}
        >
          새 분석으로
        </Link>
        <Link
          className="button secondary"
          href={demo ? "/demo?view=/cash&tab=files" : "/cash?tab=files"}
        >
          파일 관리
        </Link>
      </header>
      <p className="cash-note">
        원본의 계산·완료월 추정 방식을 유지합니다. 새 분석과 금액·기간이 다를 수
        있습니다.
      </p>
      {demo ? (
        <p className="cash-empty">
          원본 HTML 연결은 로그인 후 저장된 엑셀로 사용할 수 있습니다.
        </p>
      ) : (
        <SingleHtmlPage
          pageId="cash-old"
          title="가계부 원본 HTML"
          dataSource="cash"
        />
      )}
    </div>
  );
}
