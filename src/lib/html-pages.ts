export type HtmlPageInfo = {
  id: string;
  title: string;
  description: string;
  filename: string;
};

// This list is safe to use in both the app UI and the server-side HTML loader.
// Keep the actual file loader in src/server/html-pages.ts so a request can never
// choose an arbitrary repository path.
export const htmlPages: readonly HtmlPageInfo[] = [
  {
    id: "etf-us-yield",
    title: "ETF · 미국 국채 수익률 계산기",
    description: "미국 국채의 만기보유 수익률과 재투자 결과를 계산하는 단일 도구입니다.",
    filename: "us_yield_calculator.html",
  },
];

export function findHtmlPage(id: string) {
  return htmlPages.find((page) => page.id === id);
}
