import { naverStockSearchUrl } from "@/lib/assets";
import { pickStockMatch } from "@/lib/asset-plans";
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
  typeName?: unknown;
  typeCode?: unknown;
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
async function suggest(text: string) {
  const r = await fetch(
    `${AUTOCOMPLETE}?${new URLSearchParams({ q: text, target: "stock" })}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    },
  );
  if (!r.ok) return null;
  const body = (await r.json()) as { items?: unknown };
  return (Array.isArray(body.items) ? body.items : []) as Suggestion[];
}
async function lookup(name: string) {
  const items = await suggest(name);
  if (!items) return null;
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

export type StockSuggestion = { name: string; code: string; market: string };
const found = new Map<string, { items: StockSuggestion[]; at: number }>();
// 분할매수 전략의 종목 입력. 티커(VOO)·코드(360750)·이름 일부를 받아 후보를 돌려준다.
// 자동완성 순서를 그대로 쓰되, 코드나 이름이 정확히 같은 결과를 맨 앞에 둔다.
export async function searchNaverStocks(text: string) {
  const key = normalize(text);
  const cached = found.get(key);
  if (cached && Date.now() - cached.at < DAY) return cached.items;
  const items = await suggest(text);
  if (!items) throw Error("종목을 찾지 못했습니다. 잠시 후 다시 시도해주세요.");
  const list = items
    .filter(
      (i): i is Suggestion & { name: string; code: string } =>
        typeof i.name === "string" &&
        typeof i.code === "string" &&
        i.name.length > 0 &&
        i.name.length <= 200 &&
        i.code.length <= 40,
    )
    .map((i) => ({
      name: i.name,
      code: i.code,
      market: (typeof i.typeName === "string"
        ? i.typeName
        : typeof i.typeCode === "string"
          ? i.typeCode
          : ""
      ).slice(0, 40),
    }));
  const exact = (s: StockSuggestion) =>
    normalize(s.code) === key || normalize(s.name) === key;
  const sorted = [...list.filter(exact), ...list.filter((s) => !exact(s))];
  const result = sorted.slice(0, 8);
  found.set(key, { items: result, at: Date.now() });
  return result;
}
// 분할매수 종목 칸의 찾기. 적은 글자로 찾고, 같은 종목이 없으면 끝 단어를 떼어 두 번까지 더 찾는다.
// 네이버 자동완성은 앞부분이 맞아야 나오므로 "알파벳 A"는 없고 "알파벳"은 "알파벳 Class A"를 준다.
// 다시 찾은 결과도 처음 적은 글자와 같은 종목이어야 고른다. 끝까지 없으면 처음 나온 후보 목록을 돌려준다.
export async function findNaverStock(text: string) {
  const tokens = text.trim().split(/\s+/);
  const tries = [text.trim()];
  for (let n = tokens.length - 1; n >= 1 && tries.length < 3; n--)
    tries.push(tokens.slice(0, n).join(" "));
  let first: StockSuggestion[] | null = null;
  for (const q of tries) {
    const items = await searchNaverStocks(q);
    first ??= items.length ? items : null;
    const match = pickStockMatch(text, items);
    if (match) return { items, match };
  }
  return { items: first ?? [], match: null };
}
