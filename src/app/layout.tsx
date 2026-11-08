import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./cash.css";
import "./assets.css";
import "./pregnancy.css";
import "./baking.css";
import "./meals.css";
import "./fridge.css";
import "./share.css";
import "./cellar.css";
export const metadata: Metadata = {
  title: "MONO — Personal Workspace",
  description: "데이터, 도구, AI를 하나로 연결하는 개인 워크스페이스.",
  robots: { index: false, follow: false },
  applicationName: "MONO",
  // 홈 화면에 추가했을 때 이름과 상단 상태바. 상태바는 화면 위에 따로 두어 내용이 가려지지 않게 한다.
  appleWebApp: { capable: true, title: "MONO", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 하단 홈 막대 영역까지 쓰고 env(safe-area-inset-*)로 여백을 준다.
  viewportFit: "cover",
  themeColor: "#f8f7f3",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <a href="#main-content" className="skip-link">
          본문으로 이동
        </a>
        {children}
      </body>
    </html>
  );
}
