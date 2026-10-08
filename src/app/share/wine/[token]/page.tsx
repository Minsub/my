import { cache } from "react";
import type { Metadata } from "next";
import { appUrl } from "@/server/auth";
import { publicWineShare } from "@/server/wine-shares";
import { WineShareView } from "@/components/wine-share-view";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 로그인 없이 여는 와인 목록 공유 페이지. (family) catch-all 밖에 있어 인증을 거치지 않으며,
// 토큰으로 찾은 공유 행이 보여줄 수 있는 범위의 전부다.
const load = cache((token: string) => publicWineShare(token));
type Props = { params: Promise<{ token: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await load((await params).token);
  const base: Metadata = {
    metadataBase: new URL(appUrl()),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
  if (!share || "ended" in share) return { ...base, title: "와인 목록 공유" };
  const description = `와인 ${share.wines.length}종 · 마음에 드는 와인을 ${share.max_picks}개까지 골라주세요.`;
  const image = share.wines.find((w) => w.photo)?.photo;
  return {
    ...base,
    title: share.title,
    description,
    openGraph: {
      title: share.title,
      description,
      type: "website",
      images: image ? [{ url: image, width: 750, height: 1000 }] : undefined,
    },
  };
}
export default async function SharedWineList({ params }: Props) {
  const { token } = await params;
  const share = await load(token);
  // 없는 토큰과 끝난 공유를 같은 화면으로 둔다. 스트리밍 중 notFound()는 상태 코드를 바꾸지 못한다.
  if (!share || "ended" in share)
    return (
      <main id="main-content" className="share-page share-ended">
        <span className="share-eyebrow">WINE LIST</span>
        <h1>{share ? "공유가 끝났어요" : "링크를 찾을 수 없어요"}</h1>
        <p>
          {share
            ? "유효기간이 지났거나 공유한 사람이 링크를 껐습니다."
            : "주소가 정확한지 확인해주세요."}{" "}
          새 링크를 요청해주세요.
        </p>
      </main>
    );
  return <WineShareView token={token} share={share} />;
}
