import Link from "next/link";
import {
  ArrowUpRight,
  Coffee,
  Wine,
  Sparkles,
  Activity,
  Wallet,
} from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { dateLabel } from "@/lib/format";
export function WorkspaceHome({
  data,
  href,
}: {
  data: Snapshot;
  href: (path: string) => string;
}) {
  const modules = [
    {
      path: "/coffee",
      label: "커피",
      eyebrow: "COFFEE",
      description: "원두, 브랜드, 추출 설정을 한곳에서.",
      icon: Coffee,
      value: `${data.beans.filter((b) => !b.archived).length}종의 원두`,
    },
    {
      path: "/wine",
      label: "와인 셀러",
      eyebrow: "WINE",
      description: "보유 와인부터 구매와 시음 기록까지.",
      icon: Wine,
      value: `${data.wines.filter((w) => !w.archived).reduce((s, w) => s + w.stock, 0)}병 보유`,
    },
    {
      path: "/cash",
      label: "가계부",
      eyebrow: "CASH",
      description: "엑셀로 모으고, 수입과 지출의 흐름을 확인하세요.",
      icon: Wallet,
      value: "파일로 갱신하는 대시보드",
    },
  ];
  return (
    <>
      <header className="workspace-heading">
        <span className="eyebrow">MONO / OVERVIEW</span>
        <h1>내가 쓰는 모든 것.</h1>
        <p>
          데이터를 모으고, 도구를 만들고, 필요한 순간에 꺼내 쓰는 개인 공간.
        </p>
      </header>
      <section aria-label="내 도구" className="workspace-modules">
        {modules.map((m) => (
          <Link key={m.path} href={href(m.path)} className="workspace-module">
            <div>
              <m.icon size={26} />
              <ArrowUpRight size={20} />
            </div>
            <span className="eyebrow">{m.eyebrow}</span>
            <h2>{m.label}</h2>
            <p>{m.description}</p>
            <strong>{m.value}</strong>
          </Link>
        ))}
      </section>
      <div className="workspace-bottom">
        <section className="panel">
          <div className="section-heading compact">
            <h2>
              <Activity size={18} /> 최근 활동
            </h2>
            <span className="muted small">웹 · MCP</span>
          </div>
          {data.activities.length ? (
            <div className="activity-list">
              {data.activities.slice(0, 6).map((a) => (
                <div key={a.id}>
                  <span className="activity-icon">
                    <Activity size={16} />
                  </span>
                  <div>
                    <strong>{a.label}</strong>
                    <p>
                      {data.members.find((m) => m.user_id === a.user_id)
                        ?.name || "사용자"}{" "}
                      · {a.channel === "mcp" ? "AI로 기록" : "직접 기록"}
                    </p>
                  </div>
                  <time>{dateLabel(a.created_at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              도구를 사용하면 최근 활동이 여기에 표시됩니다.
            </p>
          )}
        </section>
        <section className="panel workspace-ai">
          <Sparkles size={24} />
          <span className="eyebrow">CONNECTED TO YOUR AI</span>
          <h2>기록을 질문으로.</h2>
          <p>AI에서 데이터를 조회하고 새로운 기록을 추가하세요.</p>
          <Link className="button secondary" href={href("/settings")}>
            MCP 연결과 사용 안내 <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
