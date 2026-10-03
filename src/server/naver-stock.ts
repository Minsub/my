import { naverStockSearchUrl } from "@/lib/assets";
// 자산 기록에는 종목 코드가 없다(증권사 CSV에 없다). 네이버 증권 자동완성으로 이름을 종목 페이지 주소로 바꾼다.
// 공개 API가 아니라 응답 모양이 바뀔 수 있으므로, 이름이 정확히 맞는 결과를 못 찾거나 실패하면
// "종목명 주가" 검색으로 연다. 틀린 종목을 여는 것보다 검색 한 번이 낫다.
const AUTOCOMPLETE = "https://ac.stock.naver.com/ac";
const STOCK_HOST = "https://stock.naver.com";
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();
type Suggestion = {
  name?: unknown;
  code?: unknown;
  url?: unknown;
  reutersCode?: unknown;
  nationCode?: unknown;
};
const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();
// 응답의 url(`/domestic/stock/005930/total` 모양)을 우선 쓰고 마지막 탭만 시세(price)로 바꾼다.
// url이 없으면 국내는 code, 해외는 reutersCode(`GOOGL.O`)로 만든다.
function pagePath(item: Suggestion) {
  const fromUrl =
    typeof item.url === "string"
      ? item.url.match(
          /^\/(?:domestic|worldstock)\/[a-z]+\/[A-Za-z0-9.\-]+(?=\/|$)/,
        )?.[0]
      : undefined;
  if (fromUrl) return `${fromUrl}/price`;
  const code = typeof item.code === "string" ? item.code : "";
  if (item.nationCode === "KOR" && /^[0-9A-Z]{6}$/.test(code))
    return `/domestic/stock/${code}/price`;
  const reuters = typeof item.reutersCode === "string" ? item.reutersCode : "";
  if (/^[A-Za-z0-9.\-]{1,20}$/.test(reuters))
    return `/worldstock/stock/${reuters}/price`;
  return null;
}
async function lookup(name: string) {
  const r = await fetch(
    `${AUTOCOMPLETE}?${new URLSearchParams({ q: name, target: "stock" })}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    },
  );
  if (!r.ok) return null;
  const body = (await r.json()) as { items?: unknown };
  const items = (Array.isArray(body.items) ? body.items : []) as Suggestion[];
  // 이름이 정확히 같은 결과만 믿는다. 공백·대소문자 차이만 무시하고, 코드로 입력한 경우(GOOGL)도 받는다.
  const want = normalize(name);
  const hit = items.find(
    (item) =>
      (typeof item.name === "string" && normalize(item.name) === want) ||
      (typeof item.code === "string" && normalize(item.code) === want),
  );
  const path = hit && pagePath(hit);
  return path ? `${STOCK_HOST}${path}` : null;
}
export async function naverStockUrl(name: string) {
  const key = normalize(name);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < DAY) return cached.url;
  let url: string | null = null;
  try {
    url = await lookup(name);
  } catch {
    // 시간 초과·형식 변경은 검색으로 대신한다.
  }
  // 못 찾은 이름도 하루 기억한다. 같은 이름을 누를 때마다 다시 묻지 않는다.
  const result = url ?? naverStockSearchUrl(name);
  cache.set(key, { url: result, at: Date.now() });
  return result;
}
