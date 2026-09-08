"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="standalone-page">
      <div className="panel consent-card">
        <h1>잠시 연결이 끊겼어요.</h1>
        <p className="muted">
          기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <button className="button primary" onClick={reset}>
          다시 시도
        </button>
      </div>
    </main>
  );
}
