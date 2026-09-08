"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  Check,
  Coffee,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
export function LoginScreen({
  local = false,
  google = false,
}: {
  local?: boolean;
  google?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand light-brand" href="/demo">
          <span className="brand-mark">
            d<span>.</span>
          </span>
          <div>
            취향의 기록<small>DAILY COLLECTION</small>
          </div>
        </Link>
        <div>
          <span className="eyebrow">A HOME FOR YOUR TASTE</span>
          <h1>
            좋아하는 것들을
            <br />
            오래 기억하는 방법.
          </h1>
          <p>
            매일의 커피와 특별한 와인,
            <br />
            우리 가족의 작은 취향을 모아요.
          </p>
          <div className="auth-illustration">
            <Coffee size={130} strokeWidth={0.7} />
            <span>
              good days
              <br />
              start here.
            </span>
          </div>
        </div>
        <span className="auth-story-footer">Made for the little things.</span>
      </section>
      <section className="auth-form-area">
        <div className="auth-card">
          <span className="eyebrow">WELCOME HOME</span>
          <h2>
            우리 집 취향에
            <br />
            들어오세요.
          </h2>
          <p>초대받은 가족 계정으로 로그인해주세요.</p>
          {google ? (
            <button
              className="button google-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const { error } = await authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/",
                  });
                  if (error) {
                    setError(error.message ?? "로그인에 실패했습니다.");
                    setBusy(false);
                  }
                } catch {
                  setError("로그인에 연결하지 못했습니다.");
                  setBusy(false);
                }
              }}
            >
              <span className="google-g">G</span>Google로 계속하기
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
          ) : (
            !local && (
              <p className="error-box">
                로그인 연결을 준비 중입니다. 관리자에게 문의해주세요.
              </p>
            )
          )}
          {local && (
            <form
              className="local-login"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const fd = new FormData(e.currentTarget);
                const { data, error } = await authClient.signIn.email({
                  email: String(fd.get("email")),
                  password: String(fd.get("password")),
                  callbackURL: "/",
                });
                if (error) {
                  setError(error.message ?? "로그인에 실패했습니다.");
                  setBusy(false);
                } else window.location.assign(data?.url ?? "/");
              }}
            >
              <span className="tag">로컬 테스트 로그인</span>
              <label className="field">
                <span>이메일</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                />
              </label>
              <label className="field">
                <span>비밀번호</span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button className="button primary" disabled={busy}>
                로그인 <ArrowRight size={16} />
              </button>
            </form>
          )}
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="login-note">
            <ShieldCheck size={18} />
            <span>
              초대된 가족만 기록을 볼 수 있어요.
              <br />
              각자의 계정으로 안전하게 함께해요.
            </span>
          </div>
          <Link className="demo-link" href="/demo">
            먼저 둘러볼게요 <ArrowRight size={15} />
          </Link>
        </div>
        <footer>
          취향의 기록 · 우리 가족만의 컬렉션 ·{" "}
          <Link href="/privacy">개인정보 처리 안내</Link>
        </footer>
      </section>
    </div>
  );
}
const scopeLabels: Record<string, string> = {
  "coffee:read": "커피 원두·취향 조회",
  "coffee:write": "원두·평가·세팅 기록",
  "wine:read": "와인·재고·시음 조회",
  "wine:write": "와인 입고·소비·시음 기록",
  openid: "내 계정 확인",
  profile: "내 이름 확인",
  email: "내 이메일 확인",
  offline_access: "연결 상태 유지",
};
export function ConsentScreen({
  scopes,
  client,
}: {
  scopes: string[];
  client: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await authClient.oauth2.consent({ accept });
      if (error) throw Error(error.message);
      if (data?.url) window.location.assign(data.url);
      else
        throw Error("연결 요청이 만료되었습니다. AI 앱에서 다시 연결해주세요.");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="standalone-page">
      <div className="consent-card panel">
        <span className="brand-mark">
          d<span>.</span>
        </span>
        <span className="eyebrow">CONNECT YOUR COLLECTION</span>
        <h1>
          AI에 우리 집 기록을
          <br />
          연결할까요?
        </h1>
        <p className="muted">{client}</p>
        <ul className="scope-list">
          {scopes.map((s) => (
            <li key={s}>
              <Check size={17} />
              {scopeLabels[s] ?? s}
            </li>
          ))}
        </ul>
        <p className="muted small">
          가족 내 내 권한 범위에서만 사용할 수 있습니다. 설정에서 언제든 연결을
          해제할 수 있어요.
        </p>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => decide(false)}
          >
            취소
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => decide(true)}
          >
            연결 허용 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </main>
  );
}
