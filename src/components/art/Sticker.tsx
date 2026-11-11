/**
 * Sticker set — one consistent storybook style: chunky ink outlines,
 * flat fills, slightly wonky geometry. Every sticker is a 64×64 SVG.
 */
import type { CSSProperties, ReactNode } from "react";

const INK = "var(--sticker-ink, #292620)";
const S = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const art: Record<string, ReactNode> = {
  flower: (
    <>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="32" cy="17" rx="9" ry="12.5" fill="#F5A9D0" {...S} transform={`rotate(${r} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="8" fill="#F7E88A" {...S} />
      <path d="M29 31.5c.6.8 1.4.8 2 0M33 31.5c.6.8 1.4.8 2 0" fill="none" {...S} strokeWidth={1.6} />
    </>
  ),
  daisy: (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <ellipse key={i} cx="32" cy="15" rx="5" ry="11" fill="#FFFDF6" {...S} strokeWidth={2} transform={`rotate(${i * 36} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="7.5" fill="#F7B53D" {...S} />
    </>
  ),
  sparkle: (
    <>
      <path d="M32 5c2 14 6 19 25 27-19 6-23 11-25 27-3-16-7-21-25-27 18-7 22-13 25-27Z" fill="#F7E88A" {...S} />
      <path d="M52 8c.6 3.5 1.6 4.6 5 5.4-3.4.8-4.4 1.9-5 5.4-.6-3.5-1.6-4.6-5-5.4 3.4-.8 4.4-1.9 5-5.4Z" fill="#FFFDF6" {...S} strokeWidth={1.8} />
    </>
  ),
  star: (
    <path d="M32 6.5l7.6 15.8 17.2 2.2-12.6 12 3.2 17.1L32 45.3l-15.4 8.3 3.2-17.1-12.6-12 17.2-2.2Z" fill="#FFB89A" {...S} />
  ),
  heart: (
    <>
      <path d="M32 54C14 41 7 32 8.5 22 10 13 21 9 28 15.5L32 20l4-4.5C43 9 54 13 55.5 22 57 32 50 41 32 54Z" fill="#EF6956" {...S} />
      <path d="M17 21c1-3.5 4-5 7-4.5" fill="none" stroke="#FFFDF6" strokeWidth={2.4} strokeLinecap="round" />
    </>
  ),
  sun: (
    <>
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M32 4.5l3.3 8h-6.6Z" fill="#FFB89A" {...S} strokeWidth={1.8} transform={`rotate(${i * 30} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="15" fill="#F7E88A" {...S} />
      <path d="M26 30c.8 1.2 2 1.2 2.8 0M35.2 30c.8 1.2 2 1.2 2.8 0M28.5 36.5c2 2 5 2 7 0" fill="none" {...S} strokeWidth={1.8} />
      <circle cx="24.5" cy="35" r="1.8" fill="#F5A9D0" />
      <circle cx="39.5" cy="35" r="1.8" fill="#F5A9D0" />
    </>
  ),
  mushroom: (
    <>
      <path d="M24 36h16l2 16c-5 2.5-15 2.5-20 0Z" fill="#FFFDF6" {...S} />
      <path d="M7 36c0-15 12-26 25-26s25 11 25 26c-12 3-38 3-50 0Z" fill="#EF6956" {...S} />
      <circle cx="22" cy="23" r="4" fill="#FFFDF6" {...S} strokeWidth={1.8} />
      <circle cx="39" cy="19" r="3" fill="#FFFDF6" {...S} strokeWidth={1.8} />
      <circle cx="45" cy="30" r="2.5" fill="#FFFDF6" {...S} strokeWidth={1.8} />
    </>
  ),
  cloud: (
    <path d="M15 46c-6 0-9.5-4.5-9-9s5-8 10-7c1-8 8-13 16-12 6 .7 10 5 11 10 5-2 12 1 13 7s-3 11-9 11Z" fill="#A9D8F2" {...S} />
  ),
  arrow: (
    <>
      <path d="M8 46c8-2 12-12 7-16s-11 4-4 9 22 4 30-6 9-16 9-16" fill="none" {...S} strokeWidth={2.6} />
      <path d="M44 9l6 8 6-9" fill="none" {...S} strokeWidth={2.6} />
    </>
  ),
  tape: (
    <path d="M4 22l54-8 3 12-1.5 2 2 2 1.5 13-54 8-2-12 1.5-2-2-2Z" fill="#F7E88A" fillOpacity={0.85} {...S} strokeWidth={1.6} strokeDasharray="0" />
  ),
  cherry: (
    <>
      <path d="M22 40c2-12 6-22 14-30M42 42c-1-12-2-20-6-32" fill="none" {...S} />
      <path d="M36 10c6-4 13-3 17 1-6 3-12 3-17-1Z" fill="#C4DBA5" {...S} strokeWidth={2} />
      <circle cx="20" cy="45" r="10" fill="#EF6956" {...S} />
      <circle cx="43" cy="47" r="10" fill="#EF6956" {...S} />
      <path d="M15 42c1-2 2.5-3 4.5-3.2M38 44c1-2 2.5-3 4.5-3.2" fill="none" stroke="#FFFDF6" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  moon: (
    <>
      <path d="M40 6C26 8 17 20 18 33s13 24 27 24c4 0 8-1 11-3-14 0-24-11-24-24 0-10 3-19 8-24Z" fill="#F7E88A" {...S} />
      <circle cx="13" cy="14" r="2.4" fill="#FFFDF6" {...S} strokeWidth={1.6} />
      <circle cx="54" cy="22" r="1.8" fill="#FFFDF6" {...S} strokeWidth={1.4} />
    </>
  ),
};

export const STICKER_LABELS: Record<string, string> = {
  flower: "flower",
  daisy: "daisy",
  sparkle: "sparkle",
  star: "star",
  heart: "heart",
  sun: "smiling sun",
  mushroom: "mushroom",
  cloud: "cloud",
  arrow: "squiggly arrow",
  tape: "washi tape",
  cherry: "cherries",
  moon: "moon",
};

export function Sticker({
  name,
  size = 56,
  style,
  className,
  title,
}: {
  name: string;
  size?: number | string;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={{ overflow: "visible", ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g filter="drop-shadow(0 1.5px 0 rgb(41 38 32 / .18))">{art[name] ?? art.sparkle}</g>
    </svg>
  );
}
