import type { MetadataRoute } from "next";

// 홈 화면에 설치해 주소창 없이 쓰기 위한 설정. 오프라인 캐시·푸시는 하지 않으므로 service worker는 두지 않는다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MONO",
    short_name: "MONO",
    description: "데이터, 도구, AI를 하나로 연결하는 개인 워크스페이스.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#f8f7f3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
