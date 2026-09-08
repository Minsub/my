"use client";
/* eslint-disable @next/next/no-img-element -- Display remote URLs directly without a server-side URL fetch/proxy. */
import { useState } from "react";
export function ProductArt({
  name,
  brand = "",
  imageUrl,
  kind = "coffee",
  large = false,
}: {
  name: string;
  brand?: string;
  imageUrl?: string | null;
  kind?: "coffee" | "wine";
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const palette = ["#6d795c", "#b27d64", "#6e8585", "#c0a667", "#927983"];
  const color =
    palette[
      Array.from(brand || name).reduce((n, c) => n + c.charCodeAt(0), 0) %
        palette.length
    ];
  return (
    <div
      className={`product-art ${large ? "art-large" : ""}`}
      style={{ "--art-color": color } as React.CSSProperties}
    >
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={`${name} 상품 이미지`}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : kind === "coffee" ? (
        <svg viewBox="0 0 240 190" aria-label="원두 패키지 일러스트" role="img">
          <ellipse cx="124" cy="174" rx="57" ry="8" fill="#000" opacity=".07" />
          <path d="M72 28h96l10 139q-53 10-112 0z" fill="#ede5d5" />
          <path d="M72 28h96l3 10H69z" fill="#d8cfbd" />
          <path d="M68 76h104l5 80q-54 7-109 0z" fill={color} />
          <path d="M77 29v35M163 29v35" stroke="#d2c8b5" />
          <text
            x="120"
            y="96"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            letterSpacing="3"
          >
            DAILY COLLECTION
          </text>
          <text
            x="120"
            y="123"
            textAnchor="middle"
            fill="white"
            fontSize="22"
            fontFamily="Georgia"
          >
            coffee.
          </text>
          <path d="M103 137h34" stroke="white" opacity=".5" />
          <circle cx="120" cy="51" r="5" fill="#b4a998" />
        </svg>
      ) : (
        <svg viewBox="0 0 240 190" aria-label="와인 병 일러스트" role="img">
          <ellipse cx="120" cy="177" rx="32" ry="6" fill="#000" opacity=".08" />
          <path
            d="M111 15h18v45c0 12 19 16 19 31v78q-28 8-56 0V91c0-15 19-19 19-31z"
            fill="#354e42"
          />
          <path d="M110 13h20v33h-20z" fill={color} />
          <path d="M93 100h54v48H93z" fill="#f1e8d8" />
          <text
            x="120"
            y="120"
            textAnchor="middle"
            fill="#645846"
            fontSize="6"
            letterSpacing="2"
          >
            THE CELLAR
          </text>
          <path d="m111 131 9-5 9 5-9 7z" fill={color} />
          <path d="M100 87v78" stroke="#fff" opacity=".1" strokeWidth="3" />
        </svg>
      )}
    </div>
  );
}
