"use client";
import { useState } from "react";
import type { Wine } from "@/lib/types";
async function photoBase64(file: File) {
  if (file.size > 20000000) throw Error("20MB 이하의 사진을 선택해주세요.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("사진을 처리할 수 없습니다.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
}
export function WinePhotoUpload({
  wine,
  onUpdated,
  demo,
}: {
  wine: Wine;
  onUpdated: () => Promise<void>;
  demo: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="panel wine-photo-upload" id="photo-upload">
      <h2>와인 사진</h2>
      <p>
        직접 찍은 병이나 라벨 사진을 올려주세요. 사진 크기를 줄이고 위치정보를
        제거해 가족에게만 보여줍니다.
      </p>
      <label className="button secondary">
        {busy ? "사진 저장 중…" : wine.has_photo ? "사진 교체" : "사진 업로드"}
        <input
          aria-label="와인 사진 업로드"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || demo}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage("");
            try {
              const image_base64 = await photoBase64(file);
              const response = await fetch(`/api/wine/${wine.id}/photo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expected_version: wine.version,
                  idempotency_key: crypto.randomUUID(),
                  image_base64,
                }),
              });
              const result = await response.json();
              if (!response.ok)
                throw Error(
                  result.error?.message || "사진 저장에 실패했습니다.",
                );
              await onUpdated();
              setMessage("사진을 저장했습니다.");
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "JPEG 또는 PNG 사진으로 다시 시도해주세요.",
              );
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <p role="status">{message}</p>
      <p className="muted small">
        JPEG · PNG · WebP 지원. 웹에서 찾을 때는{" "}
        <a
          href={`https://www.vivino.com/search/wines?q=${encodeURIComponent(`${wine.english_name || wine.name} ${wine.vintage || ""}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Vivino에서 검색
        </a>
        한 뒤 이름·생산자·빈티지가 일치하는 사진을 선택해 업로드하세요.
      </p>
    </section>
  );
}
