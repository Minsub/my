import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-page">
      <div className="panel consent-card">
        <h1>페이지를 찾지 못했어요.</h1>
        <p className="muted">주소를 확인하거나 홈으로 돌아가세요.</p>
        <Link href="/" className="button primary">
          홈으로
        </Link>
      </div>
    </main>
  );
}
