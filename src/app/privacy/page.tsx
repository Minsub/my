import Link from "next/link";

export const metadata = { title: "개인정보 처리 안내 — MONO" };

export default function Privacy() {
  return (
    <main className="standalone-page" id="main-content">
      <article className="consent-card panel privacy-card">
        <span className="eyebrow">MONO · 2026년 9월 8일</span>
        <h1>개인정보 처리 안내</h1>
        <p>
          MONO는 데이터와 도구를 관리하고 허용된 구성원과 공유할 수 있는 개인용
          서비스입니다.
        </p>
        <h2>저장하는 정보와 목적</h2>
        <p>
          Google 로그인으로 이름, 이메일, 프로필 사진, 이메일 인증 여부를 받아
          가족 계정을 식별합니다. 로그인 세션과 인증 정보를 저장하며, Google
          비밀번호는 받지 않습니다. 등록한 원두·와인·구매·시음·평가와 작성자
          정보는 가족 공간에 저장됩니다. 업로드한 와인 사진은 크기를 줄이고
          위치정보 등 메타데이터를 제거해 저장하며, 원본은 보관하지 않습니다.
        </p>
        <h2>가족 공유와 AI 연결</h2>
        <p>
          기록은 같은 가족 공간의 구성원에게 공유됩니다. AI 서비스를 직접
          연결하면 동의한 조회·쓰기 권한으로 해당 서비스가 기록을 읽거나 변경할
          수 있습니다. 설정에서 연결을 해제할 수 있으며, 이미 AI 서비스에 전달된
          정보는 해당 서비스에서 별도로 관리해야 합니다.
        </p>
        <h2>저장 위치와 쿠키</h2>
        <p>
          앱은 Vercel에서 실행하고 데이터는 Neon PostgreSQL의 싱가포르 지역에
          저장합니다. 로그인 유지를 위한 쿠키를 사용합니다. 앱에는 광고나 방문자
          분석 도구를 설치하지 않았습니다. 운영 과정에서 호스팅 서비스에
          오류·요청 로그가 남을 수 있습니다.
        </p>
        <h2>보관과 삭제 요청</h2>
        <p>
          컬렉션 기록은 사용자가 관리하는 동안 보관합니다. 계정과 기록의
          열람·수정·삭제 또는 서비스 이용 중단은 관리자에게 요청할 수 있습니다.
          재고·구매 이력은 정합성을 위해 취소 기록으로 보존할 수 있으며, 백업
          사본은 설정된 보존 기간이 끝날 때 제거됩니다.
        </p>
        <div className="button-row">
          <Link className="button secondary" href="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </article>
    </main>
  );
}
