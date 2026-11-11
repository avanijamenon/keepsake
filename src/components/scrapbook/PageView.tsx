"use client";

/**
 * Deterministic renderer: page spec + photo map → a paper page.
 * The same component powers the reader, the editor and (later) exports.
 */
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { TEMPLATES, type TemplateId, type TextSlot } from "@convex/shared/templates";
import { getTheme } from "@convex/shared/themes";
import { Sticker } from "@/components/art/Sticker";
import s from "./page.module.css";

export type PageElement =
  | { kind: "photo"; id: string; slot: string; photoId: string | null; rotation: number; caption?: string }
  | { kind: "text"; id: string; slot: string; content: string }
  | { kind: "sticker"; id: string; sticker: string; x: number; y: number; rotation: number; scale: number };

export type PageData = { _id: string; template: string; paper: string; elements: PageElement[] };
export type PhotoMap = Record<string, { url: string | null; thumbUrl: string | null; width: number; height: number }>;

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const TEXT_PLACEHOLDER: Record<string, string> = {
  title: "add a title",
  subtitle: "a few words",
  caption: "add a caption",
  note: "write a little note…",
  kicker: "label",
  date: "date",
  label: "label",
  t1: "time",
  t2: "time",
  t3: "time",
};

function hash(str: string) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const BASE_SIZE: Partial<Record<TextSlot["style"], [number, number, number]>> = {
  // [base cqw, chars before shrinking, minimum cqw]
  title: [11, 14, 6],
  subtitle: [6.4, 22, 4.2],
  handwritten: [5.6, 48, 4],
};

function fitSize(style: TextSlot["style"], length: number) {
  const cfg = BASE_SIZE[style];
  if (!cfg || length <= cfg[1]) return undefined;
  return `${Math.max(cfg[2], cfg[0] * Math.sqrt(cfg[1] / length))}cqw`;
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

export function PageView({
  page,
  photos,
  theme: themeId,
  animate = true,
  editing,
  thumb = false,
}: {
  page: PageData;
  photos: PhotoMap;
  theme: string;
  animate?: boolean;
  thumb?: boolean;
  editing?: {
    selectedId: string | null;
    onSelect: (id: string | null, slot?: string) => void;
    onStickerMove: (id: string, x: number, y: number) => void;
  };
}) {
  const tpl = TEMPLATES[page.template as TemplateId] ?? TEMPLATES.hero;
  const theme = getTheme(themeId);
  const dark = isDark(page.paper);
  const pageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const h = hash(page._id);

  const textBySlot = new Map(
    page.elements.filter((e) => e.kind === "text").map((e) => [e.slot, e] as const),
  );
  const photoBySlot = new Map(
    page.elements.filter((e) => e.kind === "photo").map((e) => [e.slot, e] as const),
  );
  const stickers = page.elements.filter((e) => e.kind === "sticker");

  const style = {
    "--paper": page.paper,
    "--page-ink": dark ? "#F5EEDC" : theme.ink,
    "--leak-a": `${theme.blobs[h % theme.blobs.length]}`,
    "--leak-b": `${theme.blobs[(h + 1) % theme.blobs.length]}`,
    "--leak-x": `${70 + (h % 25)}%`,
    "--leak-y": `${4 + (h % 10)}%`,
  } as CSSProperties;

  const select = (id: string | null, slot?: string) => (e: { stopPropagation: () => void }) => {
    if (!editing) return;
    e.stopPropagation();
    editing.onSelect(id, slot);
  };

  const onPointerDown = (id: string) => (e: PointerEvent) => {
    if (!editing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    editing.onSelect(id);
    const el = stickers.find((x) => x.id === id);
    if (el) setDrag({ id, x: el.x, y: el.y });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag || !pageRef.current) return;
    const r = pageRef.current.getBoundingClientRect();
    setDrag({
      id: drag.id,
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    });
  };
  const onPointerUp = () => {
    if (drag && editing) editing.onStickerMove(drag.id, Math.round(drag.x * 10) / 10, Math.round(drag.y * 10) / 10);
    setDrag(null);
  };

  let i = 0;
  return (
    <div
      ref={pageRef}
      className={s.page}
      style={style}
      onClick={editing ? () => editing.onSelect(null) : undefined}
      onPointerMove={drag ? onPointerMove : undefined}
      onPointerUp={drag ? onPointerUp : undefined}
    >
      {tpl.photos.map((slot) => {
        const el = photoBySlot.get(slot.name);
        const photo = el?.photoId ? photos[el.photoId] : undefined;
        if (!el || (!photo && !editing)) return null;
        const bleed = slot.x === 0 && slot.w === 100;
        const tapeHue = theme.tape[hash(el.id) % theme.tape.length];
        const showTape = !thumb && (slot.frame === "polaroid" || slot.frame === "deckled") && hash(el.id) % 3 !== 0;
        const idx = i++;
        const src = photo ? (thumb ? photo.thumbUrl : photo.url ?? photo.thumbUrl) : null;
        return (
          <div
            key={el.id}
            className={cx(
              s.el,
              animate && s.settle,
              editing && s.editable,
              editing?.selectedId === el.id && s.selected,
            )}
            style={
              {
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.w}%`,
                height: `${slot.h}%`,
                zIndex: slot.z,
                rotate: `${el.rotation}deg`,
                "--r": `${el.rotation}deg`,
                "--i": idx,
                "--from-x": `${(idx % 2 ? 1 : -1) * 14}px`,
              } as CSSProperties
            }
            onClick={select(el.id)}
            role={editing ? "button" : undefined}
            tabIndex={editing ? 0 : undefined}
            aria-label={editing ? `photo in ${slot.name} slot` : undefined}
            onKeyDown={editing ? (e) => e.key === "Enter" && editing.onSelect(el.id) : undefined}
          >
            {showTape && (
              <span
                className={s.tape}
                style={{ "--tape-c": tapeHue, "--tape-r": `${(hash(el.id) % 9) - 4}deg` } as CSSProperties}
              />
            )}
            <div className={cx(s.frame, s[slot.frame], bleed && s.bleed)}>
              <div className={slot.frame === "round" ? undefined : s.inner} style={slot.frame === "round" ? { width: "100%", height: "100%" } : undefined}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={s.img} src={src} alt="" loading="lazy" draggable={false} />
                ) : (
                  <span className={s.emptySlot}>+ photo</span>
                )}
              </div>
              {slot.frame === "polaroid" && el.caption && <span className={s.polaroidCaption}>{el.caption}</span>}
            </div>
          </div>
        );
      })}

      {tpl.texts.map((slot: TextSlot) => {
        const el = textBySlot.get(slot.name);
        const content = el?.content ?? "";
        if (!content && !editing) return null;
        const idx = i++;
        return (
          <div
            key={slot.name}
            className={cx(
              s.el,
              s.text,
              s[slot.style],
              animate && s.settle,
              editing && s.editable,
              editing && el && editing.selectedId === el.id && s.selected,
              editing?.selectedId === `slot:${slot.name}` && s.selected,
            )}
            style={
              {
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.w}%`,
                zIndex: slot.z,
                rotate: `${slot.rotate}deg`,
                textAlign: slot.align,
                // Long titles shrink to stay inside their slot.
                fontSize: fitSize(slot.style, content.length),
                "--i": idx,
              } as CSSProperties
            }
            onClick={select(el?.id ?? `slot:${slot.name}`, slot.name)}
            role={editing ? "button" : undefined}
            tabIndex={editing ? 0 : undefined}
            onKeyDown={editing ? (e) => e.key === "Enter" && editing.onSelect(el?.id ?? `slot:${slot.name}`, slot.name) : undefined}
          >
            {content || <span className={s.placeholder}>{TEXT_PLACEHOLDER[slot.name] ?? "text"}</span>}
          </div>
        );
      })}

      {stickers.map((st, si) => {
        const pos = drag?.id === st.id ? drag : st;
        return (
          <div
            key={st.id}
            className={cx(
              s.sticker,
              animate && s.pop,
              editing && s.editable,
              editing?.selectedId === st.id && s.selected,
              drag?.id === st.id && s.dragging,
            )}
            style={
              {
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                rotate: `${st.rotation}deg`,
                scale: st.scale,
                "--i": si,
              } as CSSProperties
            }
            onPointerDown={editing ? onPointerDown(st.id) : undefined}
            onClick={editing ? (e) => e.stopPropagation() : undefined}
          >
            <Sticker name={st.sticker} size="100%" />
          </div>
        );
      })}
    </div>
  );
}
