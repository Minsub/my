import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./cash.css";
export const metadata: Metadata = {
  title: "MONO — Personal Workspace",
  description: "데이터, 도구, AI를 하나로 연결하는 개인 워크스페이스.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
