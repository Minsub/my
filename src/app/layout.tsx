import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "취향의 기록 — 우리 가족의 커피와 와인",
  description:
    "커피 한 잔부터 와인 한 병까지, 우리 가족의 일상과 취향을 기록하는 공간.",
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
