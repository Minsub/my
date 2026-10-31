import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./security";
import { linkHost, youtubeId, type LinkPreview } from "@/lib/meals";

// 집밥 출처 링크의 미리보기(제목·썸네일). 저장하지 않고 볼 때 링크에서 og 태그를 읽는다.
// 서버가 사용자가 넣은 주소로 요청을 보내므로 내부망 주소로 가지 못하게 매 이동마다 검사한다.
const TIMEOUT_MS = 5000;
const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 4;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; value: LinkPreview }>();

function privateAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return privateAddress(v6.slice(7));
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    v6.startsWith("ff")
  );
}
async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new AppError("INVALID_INPUT", "http(s) 링크만 미리 볼 수 있습니다.");
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new AppError(
      "INVALID_INPUT",
      "기본 포트 링크만 미리 볼 수 있습니다.",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(privateAddress))
    throw new AppError("INVALID_INPUT", "미리 볼 수 없는 주소입니다.");
}
async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - at);
    out.set(part, at);
    at += part.length;
    if (at >= out.length) break;
  }
  return out;
}
// 한국 사이트는 아직 EUC-KR이 있다. 헤더 → meta 순서로 문자셋을 찾는다.
function decode(bytes: Uint8Array, contentType: string) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const label =
    contentType.match(/charset=([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
function entities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
function metaContent(html: string, names: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!key || !names.includes(key.toLowerCase())) continue;
    const value = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
    if (value?.trim()) return entities(value.trim());
  }
  return null;
}
function absoluteHttp(value: string | null, base: URL) {
  if (!value) return null;
  try {
    const u = new URL(value, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
async function fetchPage(start: URL) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // 일부 사이트는 브라우저가 아니면 og 태그 없는 페이지를 준다.
        "User-Agent": "Mozilla/5.0 (compatible; MONO-link-preview/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko,en;q=0.8",
      },
    });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      await res.body?.cancel().catch(() => {});
      url = new URL(next, url);
      continue;
    }
    return { res, url };
  }
  throw new AppError("INVALID_INPUT", "링크 이동이 너무 많습니다.");
}
async function readPreview(link: string): Promise<LinkPreview> {
  const start = new URL(link);
  const site = linkHost(link);
  const video = youtubeId(link);
  // YouTube 페이지는 크고 동의 화면이 끼기도 해서 oEmbed로 제목을 읽고 썸네일은 영상 ID로 만든다.
  if (video) {
    const image = `https://i.ytimg.com/vi/${video}/hqdefault.jpg`;
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      const body = res.ok ? ((await res.json()) as { title?: string }) : {};
      return { url: link, title: body.title ?? null, image, site: "YouTube" };
    } catch {
      return { url: link, title: null, image, site: "YouTube" };
    }
  }
  const { res, url } = await fetchPage(start);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/html|xml/i.test(type)) {
    await res.body?.cancel().catch(() => {});
    return { url: link, title: null, image: null, site };
  }
  const html = decode(await readLimited(res), type);
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ??
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ? entities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1].trim())
      : null);
  const image = absoluteHttp(
    metaContent(html, [
      "og:image",
      "og:image:url",
      "twitter:image",
      "twitter:image:src",
    ]),
    url,
  );
  return {
    url: link,
    title: title ? title.slice(0, 200) : null,
    image,
    site: metaContent(html, ["og:site_name"])?.slice(0, 60) ?? site,
  };
}
export async function linkPreview(link: string): Promise<LinkPreview> {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new AppError("INVALID_INPUT", "링크 주소를 확인해주세요.");
  }
  const key = parsed.href;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value: LinkPreview;
  try {
    value = await readPreview(key);
  } catch (e) {
    if (e instanceof AppError) throw e;
    // 사이트가 막거나 느린 것은 오류가 아니다. 제목·썸네일 없이 링크만 보인다.
    value = { url: key, title: null, image: null, site: linkHost(key) };
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}
