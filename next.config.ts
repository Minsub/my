import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/html-pages/*": [
      "./docs/cash-money/cash-money.html",
      "./src/html/us_yield_calculator.html",
      "./node_modules/xlsx/dist/xlsx.full.min.js",
      "./node_modules/chart.js/dist/chart.umd.js",
    ],
  },
  serverExternalPackages: ["pg"],
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
    ];
  },
};
export default config;
