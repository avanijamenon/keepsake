"use client";

import type { CSSProperties } from "react";
import { Pip } from "@/components/art/Doodles";
import { Sticker } from "@/components/art/Sticker";
import s from "./sorting.module.css";

/**
 * Not a spinner: prints fly off a pile and settle into an open book while
 * Pip helps. The text underneath is the job's real, current step.
 */
export function SortingScene({ thumbs, step, title }: { thumbs: string[]; step: string; title: string }) {
  const prints = (thumbs.length ? thumbs : Array.from({ length: 6 }, () => "")).slice(0, 6);
  return (
    <div className={s.scene} role="status" aria-live="polite">
      <div className={s.stage} aria-hidden>
        <div className={s.pile}>
          {prints.map((src, i) => (
            <span
              key={i}
              className={s.print}
              style={{ "--i": i, "--n": prints.length, "--tx": `${(i % 3) * 58 + 150}px`, "--ty": `${Math.floor(i / 3) * 72 - 40}px`, "--r": `${(i % 2 ? 1 : -1) * (4 + i)}deg` } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img src={src} alt="" /> : <span className={s.blank} />}
            </span>
          ))}
        </div>
        <div className={s.book}>
          <span className={s.leftPage} />
          <span className={s.rightPage} />
          <span className={s.gutter} />
        </div>
        <Pip mood="busy" size={88} className={s.pip} />
        <Sticker name="sparkle" size={34} className={s.spark} />
        <Sticker name="star" size={28} className={s.spark2} />
      </div>
      <h1 className={s.title}>{title}</h1>
      <p className={s.step}>{step}…</p>
    </div>
  );
}
