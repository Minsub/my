"use client";
import Link from "next/link";
import { Maximize2, RotateCcw } from "lucide-react";
import {
  clockColors,
  clockFontLook,
  clockFonts,
  clockSecondsModes,
  clockSizeRange,
  clockSpacings,
  clockStretchRange,
  clockWeights,
  defaultClockSettings,
  type ClockSettings,
} from "@/lib/clock-settings";
import { ClockDisplay } from "./clock-display";
import { useClockSettings } from "./use-clock-settings";

// 취미 / 시계 / 설정. 고르는 즉시 미리보기와 시계 화면에 반영되고 이 기기에만 저장된다.
export function ClockSettingsPage({
  demo = false,
  href,
}: {
  demo?: boolean;
  href: (path: string) => string;
}) {
  const { settings, update, reset } = useClockSettings(demo);
  const choice = <K extends keyof ClockSettings>(
    key: K,
    value: ClockSettings[K],
  ) => ({
    type: "button" as const,
    "aria-pressed": settings[key] === value,
    onClick: () => update({ [key]: value } as Partial<ClockSettings>),
  });
  return (
    <div className="clock-set">
      <div className="clock-set-top">
        <div className="page-heading">
          <div>
            <span className="eyebrow">MONO / HOBBY / CLOCK</span>
            <h1>
              시계 설정<span className="heading-dot">.</span>
            </h1>
            <p>고르는 대로 아래 미리보기와 시계 화면에 바로 반영돼요.</p>
          </div>
        </div>
        <div className="clock-set-actions">
          <button
            type="button"
            className="button secondary"
            onClick={reset}
            disabled={
              JSON.stringify(settings) === JSON.stringify(defaultClockSettings)
            }
          >
            <RotateCcw size={16} />
            기본값으로
          </button>
          <Link className="button primary" href={href("/hobby/clock/view")}>
            <Maximize2 size={16} />
            시계 보기
          </Link>
        </div>
      </div>

      <div className="clock-preview" aria-label="시계 미리보기">
        <ClockDisplay settings={settings} demo={demo} />
      </div>

      <div className="clock-set-list">
        <div className="clock-set-row">
          <span>글꼴</span>
          <div className="clock-options">
            {clockFonts.map((f) => (
              <button
                key={f.id}
                className="clock-font-chip"
                type="button"
                aria-pressed={settings.font === f.id}
                onClick={() => update({ font: f.id, ...clockFontLook(f.id) })}
              >
                <b
                  style={{ fontFamily: f.family, fontWeight: settings.weight }}
                >
                  12:34
                </b>
                <small>{f.label}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="clock-set-row">
          <span>굵기</span>
          <div className="clock-options">
            {clockWeights.map((w) => (
              <button
                key={w.value}
                className="clock-chip"
                {...choice("weight", w.value)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <ColorRow
          label="숫자 색"
          id="clock-digit-color"
          value={settings.digit}
          onChange={(digit) => update({ digit })}
        />
        <ColorRow
          label="날짜·날씨 색"
          id="clock-info-color"
          value={settings.info}
          onChange={(info) => update({ info })}
        />
        <div className="clock-set-row">
          <span>
            초<small>작게 하면 시·분이 더 커져요</small>
          </span>
          <div className="clock-options">
            {clockSecondsModes.map((m) => (
              <button
                key={m.value}
                className="clock-chip"
                {...choice("seconds", m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="clock-set-row">
          <span>
            숫자 간격<small>좁게·보통·넓게는 화면을 꽉 채워요</small>
          </span>
          <div className="clock-options">
            {clockSpacings.map((g) => (
              <button
                key={g.value}
                className="clock-chip"
                {...choice("spacing", g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <RangeRow
          id="clock-size"
          label="크기"
          note="100%가 화면 너비를 꽉 채운 크기"
          range={clockSizeRange}
          value={settings.size}
          onChange={(size) => update({ size })}
        />
        <RangeRow
          id="clock-stretch"
          label="세로 늘이기"
          note="너비는 그대로 숫자만 위아래로 늘여요"
          range={clockStretchRange}
          value={settings.stretch}
          onChange={(stretch) => update({ stretch })}
        />
        <div className="clock-set-row">
          <span>가운데 줄</span>
          <div className="clock-options">
            <button className="clock-chip" {...choice("centerLine", false)}>
              없음
            </button>
            <button className="clock-chip" {...choice("centerLine", true)}>
              플립 시계처럼
            </button>
          </div>
        </div>
        <div className="clock-set-row">
          <span>1~9시</span>
          <div className="clock-options">
            <button className="clock-chip" {...choice("padHour", false)}>
              9:05
            </button>
            <button className="clock-chip" {...choice("padHour", true)}>
              09:05
            </button>
          </div>
        </div>
      </div>

      <p className="clock-set-note">
        설정은 이 기기의 이 브라우저에만 저장돼요. iPad 홈 화면에 추가한 MONO는
        Safari와 저장 공간이 따로라서, 홈 화면 앱 안에서 설정해 주세요.
        {demo && " 둘러보기에서는 바꿔 볼 수만 있고 저장되지 않아요."}
      </p>
    </div>
  );
}

function RangeRow({
  id,
  label,
  note,
  range,
  value,
  onChange,
}: {
  id: string;
  label: string;
  note: string;
  range: { min: number; max: number; step: number };
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="clock-set-row">
      <label htmlFor={id}>
        {label}
        <small>{note}</small>
      </label>
      <div className="clock-range">
        <input
          id={id}
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output htmlFor={id}>{value}%</output>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const preset = clockColors.some((c) => c.value === value);
  return (
    <div className="clock-set-row">
      <span>{label}</span>
      <div className="clock-options">
        {clockColors.map((c) => (
          <button
            key={c.value}
            type="button"
            className="clock-swatch"
            style={{ background: c.value }}
            aria-label={c.label}
            title={c.label}
            aria-pressed={value === c.value}
            onClick={() => onChange(c.value)}
          />
        ))}
        <label className="clock-custom" htmlFor={id}>
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {preset ? "직접 고르기" : value}
        </label>
      </div>
    </div>
  );
}
