"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { getTheme } from "@convex/shared/themes";
import { Sticker } from "@/components/art/Sticker";
import s from "./cover.module.css";

const STICKER_FOR: Record<string, string> = {
  "sunny-afternoon": "sun",
  bubblegum: "heart",
  "pistachio-garden": "mushroom",
  seaside: "cloud",
  "tomato-picnic": "cherry",
  "film-night": "moon",
};

/** A little book on the shelf: spine, cover photo, title, a sticker. */
export function MemoryCover({
  href,
  title,
  subtitle,
  theme,
  coverUrl,
  status,
  pageCount,
  tilt = 0,
}: {
  href: string;
  title: string;
  subtitle: string;
  theme: string;
  coverUrl: string | null;
  status: "draft" | "published";
  pageCount: number;
  tilt?: number;
}) {
  const t = getTheme(theme);
  const dark = theme === "film-night";
  return (
    <Link
      href={href}
      className={s.book}
      style={
        {
          "--tilt": `${tilt}deg`,
          "--a": t.blobs[0],
          "--b": t.blobs[1],
          "--c": t.blobs[2],
          "--paper": t.papers[0],
          "--accent": t.accent,
          "--ink-c": dark ? "#F5EEDC" : "#292620",
        } as CSSProperties
      }
      aria-label={`${title}, ${subtitle}${status === "draft" ? ", draft" : ""}`}
    >
      <span className={s.spine} aria-hidden />
      <span className={s.coverArt} aria-hidden />
      <span className={s.print}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" loading="lazy" />
        ) : (
          <span className={s.noPhoto} />
        )}
      </span>
      <span className={s.title}>{title}</span>
      <span className={s.sub}>{subtitle}</span>
      <span className={s.meta}>{pageCount} pages</span>
      <Sticker name={STICKER_FOR[theme] ?? "sparkle"} size={38} className={s.sticker} />
      {status === "draft" && <span className={s.draft}>draft</span>}
    </Link>
  );
}
