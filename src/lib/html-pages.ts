export type HtmlPageInfo = {
  id: string;
  title: string;
  description: string;
  filename: string;
};

// This list is safe to use in both the app UI and the server-side HTML loader.
// Keep the actual file loader in src/server/html-pages.ts so a request can never
export const htmlPages: readonly HtmlPageInfo[] = [
  {
    id: "asset-return",
    title: "아파트 vs 주식 자산 비교 계산기",
    description:
      "자본금과 매매가 기준 대출·주식 대체투자를 84㎡ 갈아타기 취득세와 함께 비교하는 단일 도구입니다.",
    filename: "asset_return_calculator.html",
  },
  {
    id: "etf-us-yield",
    title: "ETF · 미국 국채 수익률 계산기",
    description:
      "미국 국채의 만기보유 수익률과 재투자 결과를 계산하는 단일 도구입니다.",
    filename: "us_yield_calculator.html",
  },
];

export function findHtmlPage(id: string) {
  return htmlPages.find((page) => page.id === id);
}

// 웹에서 올린 단일 HTML(html_uploads). 실행 경로는 /etc/html/{uuid}이고 등록 키(slug)와 겹치지 않는다.
export type HtmlUpload = {
  id: string;
  title: string;
  description: string;
  filename: string;
  bytes: number;
  version: number;
  updated_at: string;
  canEdit: boolean;
};
export const HTML_UPLOAD_MAX_BYTES = 3_000_000;
export const HTML_UPLOAD_LIMIT = 50;
export const isHtmlUploadId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
