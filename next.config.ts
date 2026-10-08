import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/html-pages/*": [
      "./docs/cash-money/cash-money.html",
      "./src/html/asset_return_calculator.html",
      "./src/html/us_yield_calculator.html",
      "./src/html/us_yield_calculator.tailwind.css",
      "./node_modules/xlsx/dist/xlsx.full.min.js",
      "./node_modules/chart.js/dist/chart.umd.js",
    ],
  },
  serverExternalPackages: ["pg"],
  // 링크 미리보기 봇은 <head>의 og 태그만 읽는다. 공유 페이지 메타데이터를 스트리밍하지 않도록 카카오톡 스크래퍼를 더한다.
  htmlLimitedBots:
    /kakaotalk-scrap|facebookexternalhit|Twitterbot|Slackbot|Discordbot|WhatsApp|TelegramBot|LinkedInBot|Yeti|[\w-]+-Google|Google-[\w-]+|Bingbot/i,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      // 로그인 없이 여는 공유 페이지. 링크(토큰)가 다른 사이트로 새거나 검색에 걸리지 않게 한다.
      {
        source: "/share/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/share/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
export default config;
