"use client";
/* eslint-disable @next/next/no-img-element -- 인증된 앱 라우트의 WebP를 그대로 보여준다. */
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Brand } from "@/lib/types";
import { photoBase64 } from "./wine-photo-upload";
export const brandPhotoUrl = (b: Brand) =>
  `/api/coffee/brands/${b.id}/photo?v=${b.version}`;
// 브랜드 대표 이미지. 없으면 첫 글자 모노그램을 보여준다.
export function BrandMark({
  brand,
  tone,
  small = false,
}: {
  brand: Brand;
  tone: number;
  small?: boolean;
}) {
  return (
    <div
      className={`brand-monogram tone-${tone}${small ? " small" : ""}${brand.has_photo ? " has-photo" : ""}`}
    >
      {brand.has_photo ? (
        <img src={brandPhotoUrl(brand)} alt="" loading="lazy" />
      ) : (
        brand.name.slice(0, 1)
      )}
    </div>
  );
}
// 웹 전용 업로드. MCP로는 올리지 않는다.
export function BrandPhotoButton({
  brand,
  onUpdated,
  onMessage,
  demo,
}: {
  brand: Brand;
  onUpdated: () => Promise<void>;
  onMessage: (text: string) => void;
  demo: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label
      className={`icon-button brand-photo-button${busy ? " busy" : ""}`}
      title={brand.has_photo ? "대표 이미지 교체" : "대표 이미지 올리기"}
    >
      <ImagePlus size={16} />
      <input
        aria-label={`${brand.name} 대표 이미지 올리기`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onClick={(e) => {
          if (!demo) return;
          e.preventDefault();
          onMessage("둘러보기 화면입니다. 로그인하면 이미지를 올릴 수 있어요.");
        }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const image_base64 = await photoBase64(file);
            const response = await fetch(
              `/api/coffee/brands/${brand.id}/photo`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expected_version: brand.version,
                  image_base64,
                }),
              },
            );
            const result = await response.json();
            if (!response.ok)
              throw Error(
                result.error?.message || "이미지 저장에 실패했습니다.",
              );
            await onUpdated();
            onMessage("브랜드 이미지를 저장했습니다.");
          } catch (error) {
            onMessage(
              error instanceof Error
                ? error.message
                : "JPEG, PNG, WebP 사진으로 다시 시도해주세요.",
            );
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}
