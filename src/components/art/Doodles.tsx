/**
 * Larger illustrations and doodles: Pip (the little paper-scrap mascot who
 * looks after your memories), hand-drawn squiggles and scalloped shapes.
 */
import type { CSSProperties } from "react";

const S = { stroke: "#292620", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export type PipMood = "happy" | "sleepy" | "busy" | "wow";

export function Pip({
  mood = "happy",
  size = 120,
  color = "#FFB89A",
  className,
  style,
}: {
  mood?: PipMood;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * (130 / 120)} className={className} style={style} aria-hidden>
      {/* legs */}
      <path d="M46 104l-4 18h-8M74 104l4 18h8" fill="none" {...S} />
      {/* body: a torn paper scrap */}
      <path
        d="M24 30c2-10 10-16 22-17 6 4 10 0 16-1 10-1 20 2 29 6 8 4 11 12 10 22l-2 14 3 10c1 14-2 26-10 34-9 8-24 10-38 9-15-1-27-5-31-17-3-9 1-17 0-26-1-7-3-14-1-21 1-5 2-9 2-13Z"
        fill={color}
        {...S}
      />
      {/* paper fold */}
      <path d="M84 18c2 6 7 10 13 11" fill="none" {...S} strokeWidth={2} />
      {/* face */}
      {mood === "sleepy" ? (
        <path d="M40 58c3 3 7 3 10 0M68 58c3 3 7 3 10 0" fill="none" {...S} />
      ) : mood === "wow" ? (
        <>
          <circle cx="45" cy="57" r="5" fill="#292620" />
          <circle cx="73" cy="57" r="5" fill="#292620" />
          <circle cx="47" cy="55" r="1.6" fill="#fff" />
          <circle cx="75" cy="55" r="1.6" fill="#fff" />
        </>
      ) : (
        <>
          <circle cx="45" cy="57" r="3.6" fill="#292620" />
          <circle cx="73" cy="57" r="3.6" fill="#292620" />
        </>
      )}
      {mood === "wow" ? (
        <ellipse cx="59" cy="72" rx="5" ry="6" fill="#292620" />
      ) : mood === "busy" ? (
        <path d="M52 70c4 2 10 2 14 0" fill="none" {...S} />
      ) : (
        <path d="M50 68c4 6 14 6 18 0" fill="none" {...S} />
      )}
      <ellipse cx="36" cy="66" rx="5" ry="3" fill="#F5A9D0" opacity={0.9} />
      <ellipse cx="82" cy="66" rx="5" ry="3" fill="#F5A9D0" opacity={0.9} />
      {/* arms */}
      {mood === "busy" ? (
        <path d="M22 70c-8-2-12-8-12-14M98 70c8-2 12-8 12-14" fill="none" {...S} />
      ) : (
        <path d="M22 72c-7 4-10 10-10 16M98 72c7 4 10 10 10 16" fill="none" {...S} />
      )}
    </svg>
  );
}

export function Squiggle({
  className,
  style,
  color = "#292620",
}: {
  className?: string;
  style?: CSSProperties;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 220 120" className={className} style={style} aria-hidden fill="none">
      <path
        d="M4 108c30 4 52-6 56-26 3-15-9-22-17-15-9 8 1 26 22 26 30 0 58-26 80-50 14-15 30-28 50-34"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path d="M180 4l17 4-9 15" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Underline({ color = "#EF6956", className }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 16" preserveAspectRatio="none" className={className} aria-hidden fill="none">
      <path d="M3 10c40-6 90-8 130-4 22 2 40 3 64-3" stroke={color} strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

/** A scalloped (flower-edged) disc path — used for badges and buttons. */
export function scallopPath(cx: number, cy: number, r: number, bumps = 12, depth = 0.12) {
  const pts: string[] = [];
  const steps = bumps * 12;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 - depth / 2 + (depth / 2) * Math.cos(a * bumps));
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Soft wavy separator. */
export function Wave({ color = "#292620", className }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 400 14" preserveAspectRatio="none" className={className} aria-hidden fill="none">
      <path
        d={`M0 7 ${Array.from({ length: 40 }, (_, i) => `Q${i * 10 + 5} ${i % 2 ? 13 : 1} ${i * 10 + 10} 7`).join(" ")}`}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
