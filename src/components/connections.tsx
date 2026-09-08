"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Check, Sparkles, Unplug, ArrowUpRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
const subscribe = () => () => {};
const getConnectionUrl = () => `${window.location.origin}/api/mcp`;
const getServerUrl = () => "";
type Consent = { id: string; clientId: string; scopes: string[] };
export function ConnectionSettings({ demo = false }: { demo?: boolean }) {
  const url = useSyncExternalStore(subscribe, getConnectionUrl, getServerUrl);
  const [copied, setCopied] = useState(false),
    [consents, setConsents] = useState<Consent[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!demo)
      authClient.oauth2.getConsents().then(({ data, error }) => {
        if (error) setError("AI 연결 목록을 가져오지 못했습니다.");
        else setConsents((data ?? []) as Consent[]);
      });
  }, [demo]);
  return (
    <section className="panel connections">
      <div className="section-heading compact">
        <h2>
          <Sparkles size={20} /> AI와 취향 연결하기
        </h2>
        <span className="tag green">MCP</span>
      </div>
      <p className="muted">
        Claude, ChatGPT, Codex에서 우리 가족의 기록을 조회하고 관리할 수 있어요.
      </p>
      <label className="connection-url">
        <span>MCP 연결 주소</span>
        <div>
          <input readOnly value={url} aria-label="MCP 연결 주소" />
          <button
            className="icon-button"
            aria-label="연결 주소 복사"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("주소를 선택해 직접 복사해주세요.");
              }
            }}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </div>
      </label>
      <div className="connection-steps">
        <div>
          <b>01</b>
          <span>AI 앱에 연결 주소를 추가해요.</span>
        </div>
        <div>
          <b>02</b>
          <span>내 가족 계정으로 로그인해요.</span>
        </div>
        <div>
          <b>03</b>
          <span>조회·기록 권한을 확인하고 연결해요.</span>
        </div>
      </div>
      <div className="connection-links">
        <a
          target="_blank"
          rel="noreferrer"
          href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
        >
          Claude <ArrowUpRight size={14} />
        </a>
        <a
          target="_blank"
          rel="noreferrer"
          href="https://developers.openai.com/plugins/deploy/connect-chatgpt"
        >
          ChatGPT <ArrowUpRight size={14} />
        </a>
        <a
          target="_blank"
          rel="noreferrer"
          href="https://learn.chatgpt.com/docs/extend/mcp?surface=cli"
        >
          Codex <ArrowUpRight size={14} />
        </a>
      </div>
      <h3>내가 연결한 AI</h3>
      {consents.length ? (
        consents.map((c) => (
          <div className="consent-row" key={c.id}>
            <div>
              <strong>{c.clientId}</strong>
              <p>{c.scopes.join(" · ")}</p>
            </div>
            <button
              className="button secondary small-button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(c.id);
                const { error } = await authClient.$fetch("/daily/disconnect", {
                  method: "POST",
                  body: { id: c.id },
                });
                if (error) setError("연결 해제에 실패했습니다.");
                else setConsents((cs) => cs.filter((x) => x.id !== c.id));
                setBusy(null);
              }}
            >
              <Unplug size={14} />
              해제
            </button>
          </div>
        ))
      ) : (
        <p className="muted small">아직 연결한 AI가 없습니다.</p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
