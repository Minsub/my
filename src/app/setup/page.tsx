import Link from "next/link";
import { ArrowRight, Coffee } from "lucide-react";
export default function Setup() {
  return (
    <main className="standalone-page" id="main-content">
      <div className="consent-card panel">
        <span className="brand-mark">M</span>
        <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
        <h1>
          MONO를
          <br />
          준비하고 있어요.
        </h1>
        <p className="muted">
          로그인과 데이터 연결을 준비 중입니다.
          <br />
          먼저 커피 컬렉션을 둘러보세요.
        </p>
        <div className="button-row">
          <Link className="button primary" href="/demo">
            <Coffee size={16} />
            둘러보기 <ArrowRight size={16} />
          </Link>
          <Link className="button secondary" href="/login">
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
