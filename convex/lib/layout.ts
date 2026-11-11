/**
 * Layout engine: turns curated, event-grouped photos into a structured page
 * specification. Deterministic for a given seed so retries are idempotent.
 * AI never draws pages — it only contributes grounded text.
 */
import { TEMPLATES, type TemplateId } from "../shared/templates";
import { getTheme, type StickerId } from "../shared/themes";

export const SCHEMA_VERSION = 1;

export type LayoutPhoto = {
  id: string;
  takenAt: number;
  score: number;
  width: number;
  height: number;
  caption?: string;
};

export type LayoutEvent = { label: string; photos: LayoutPhoto[] };

type Element =
  | { kind: "photo"; id: string; slot: string; photoId: string | null; rotation: number; caption?: string }
  | { kind: "text"; id: string; slot: string; content: string }
  | { kind: "sticker"; id: string; sticker: string; x: number; y: number; rotation: number; scale: number };

export type PageSpec = { template: TemplateId; paper: string; elements: Element[] };

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function seedFrom(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function time(ts: number, tz: number) {
  const d = new Date(ts - tz * 60000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}`;
}

function shortDate(ts: number, tz: number) {
  const d = new Date(ts - tz * 60000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3).toLowerCase()}`;
}

/** Split n photos into page-sized chunks with some rhythm and variety. */
function planChunks(n: number, rand: () => number): number[] {
  const chunks: number[] = [];
  let left = n;
  let first = true;
  while (left > 0) {
    let size: number;
    if (first && n >= 4) size = 1; // open bigger events with a hero moment
    else if (left <= 3) size = left;
    else if (left === 4) size = rand() < 0.5 ? 4 : 2;
    else {
      const options = [2, 3, 3, 4, 4, 5];
      size = options[Math.floor(rand() * options.length)];
      if (left - size === 1) size = Math.min(left, size + 1 <= 5 ? size + 1 : size - 1);
    }
    chunks.push(size);
    left -= size;
    first = false;
  }
  return chunks;
}

const TEMPLATE_BY_SIZE: Record<number, TemplateId[]> = {
  1: ["hero", "journal"],
  2: ["duo"],
  3: ["polaroid-cluster", "timeline"],
  4: ["grid", "collage"],
  5: ["scattered"],
};

const STICKER_SPOTS: Record<TemplateId, { x: number; y: number }[]> = {
  cover: [{ x: 84, y: 14 }, { x: 12, y: 64 }, { x: 88, y: 62 }],
  hero: [{ x: 88, y: 84 }, { x: 90, y: 6 }],
  duo: [{ x: 86, y: 10 }, { x: 14, y: 72 }, { x: 88, y: 92 }],
  "polaroid-cluster": [{ x: 10, y: 6 }, { x: 88, y: 64 }, { x: 8, y: 54 }],
  timeline: [{ x: 84, y: 8 }, { x: 80, y: 92 }, { x: 18, y: 42 }],
  grid: [{ x: 92, y: 6 }, { x: 6, y: 92 }],
  scattered: [{ x: 46, y: 26 }, { x: 10, y: 92 }, { x: 92, y: 50 }],
  collage: [{ x: 90, y: 10 }, { x: 50, y: 56 }, { x: 88, y: 94 }],
  journal: [{ x: 14, y: 30 }, { x: 88, y: 92 }, { x: 12, y: 52 }],
  outro: [{ x: 30, y: 22 }, { x: 70, y: 22 }, { x: 50, y: 74 }],
};

export function buildScrapbook(input: {
  seed: number;
  theme: string;
  title: string;
  kicker: string;
  periodLabel: string;
  contributors: string[];
  events: LayoutEvent[];
  tzOffsetMinutes: number;
}): { pages: PageSpec[]; coverPhotoId: string | null } {
  const rand = rng(input.seed);
  const theme = getTheme(input.theme);
  const tz = input.tzOffsetMinutes;
  let n = 0;
  const uid = (p: string) => `${p}_${(n++).toString(36)}`;
  const jitter = (base: number, spread = 3) =>
    Math.round((base + (rand() - 0.5) * spread) * 10) / 10;
  const paper = (i: number) => theme.papers[i % theme.papers.length];
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const stickerPool: StickerId[] =
    theme.id === "film-night"
      ? ["moon", "star", "sparkle", "heart", "tape"]
      : theme.id === "pistachio-garden"
        ? ["mushroom", "daisy", "flower", "sun", "tape", "sparkle"]
        : theme.id === "seaside"
          ? ["cloud", "sun", "star", "sparkle", "tape", "daisy"]
          : ["flower", "daisy", "sparkle", "heart", "cherry", "star", "sun", "tape"];

  const stickers = (template: TemplateId, count: number): Element[] => {
    const spots = [...STICKER_SPOTS[template]].sort(() => rand() - 0.5).slice(0, count);
    return spots.map((s) => ({
      kind: "sticker" as const,
      id: uid("st"),
      sticker: pick(stickerPool),
      x: jitter(s.x, 4),
      y: jitter(s.y, 4),
      rotation: Math.round((rand() - 0.5) * 40),
      scale: Math.round((0.8 + rand() * 0.5) * 100) / 100,
    }));
  };

  const all = input.events.flatMap((e) => e.photos);
  const coverPhoto = [...all].sort((a, b) => b.score - a.score)[0];
  const pages: PageSpec[] = [];

  // Cover
  pages.push({
    template: "cover",
    paper: paper(0),
    elements: [
      { kind: "text", id: uid("tx"), slot: "kicker", content: input.kicker },
      ...(coverPhoto
        ? [{ kind: "photo" as const, id: uid("ph"), slot: "hero", photoId: coverPhoto.id, rotation: jitter(-3) }]
        : []),
      { kind: "text", id: uid("tx"), slot: "title", content: input.title },
      { kind: "text", id: uid("tx"), slot: "subtitle", content: input.periodLabel },
      ...stickers("cover", 2),
    ],
  });

  let last: TemplateId = "cover";
  for (const event of input.events) {
    const photos = event.photos
      .filter((p) => p.id !== coverPhoto?.id || all.length < 3)
      .sort((a, b) => a.takenAt - b.takenAt);
    if (!photos.length) continue;
    const chunks = planChunks(photos.length, rand);
    // The hero opener should be the event's strongest photo.
    if (chunks[0] === 1 && photos.length > 1) {
      const best = [...photos].sort((a, b) => b.score - a.score)[0];
      photos.splice(photos.indexOf(best), 1);
      photos.unshift(best);
    }
    let cursor = 0;
    chunks.forEach((size, ci) => {
      const group = photos.slice(cursor, cursor + size);
      cursor += size;
      const options = TEMPLATE_BY_SIZE[size].filter((t) => t !== last);
      const template: TemplateId =
        size === 1 && ci > 0 ? "journal" : (options.length ? pick(options) : TEMPLATE_BY_SIZE[size][0]);
      const tpl = TEMPLATES[template];
      last = template;
      const elements: Element[] = tpl.photos.map((slot, i) => ({
        kind: "photo" as const,
        id: uid("ph"),
        slot: slot.name,
        photoId: group[i]?.id ?? null,
        rotation: slot.frame === "plain" && template !== "collage" ? 0 : jitter(slot.rotate, 3),
      }));
      const lead = group[0];
      const span = group.length > 1 ? `${time(group[0].takenAt, tz)} – ${time(group[group.length - 1].takenAt, tz)}` : time(lead.takenAt, tz);
      const text = (slot: string, content: string) =>
        tpl.texts.some((t) => t.name === slot)
          ? [{ kind: "text" as const, id: uid("tx"), slot, content }]
          : [];
      const aiCaption = group.find((p) => p.caption)?.caption;
      elements.push(
        ...text("title", ci === 0 ? event.label.toLowerCase() : ""),
        ...text("caption", aiCaption ?? `${shortDate(lead.takenAt, tz)}, ${span}`),
        ...text("date", `${shortDate(lead.takenAt, tz)}\n${time(lead.takenAt, tz)}`),
        ...text("note", aiCaption ?? ""),
        ...text("t1", group[0] ? time(group[0].takenAt, tz) : ""),
        ...text("t2", group[1] ? time(group[1].takenAt, tz) : ""),
        ...text("t3", group[2] ? time(group[2].takenAt, tz) : ""),
        ...stickers(template, template === "grid" || template === "hero" ? 1 : 1 + Math.floor(rand() * 2)),
      );
      pages.push({ template, paper: paper(pages.length), elements });
    });
  }

  const who = input.contributors.length
    ? `kept by ${input.contributors.join(" & ")}`
    : "kept with love";
  pages.push({
    template: "outro",
    paper: paper(pages.length),
    elements: [
      { kind: "text", id: uid("tx"), slot: "title", content: "the end, for now" },
      { kind: "text", id: uid("tx"), slot: "note", content: `${all.length} little moments, ${who}` },
      { kind: "text", id: uid("tx"), slot: "label", content: input.periodLabel },
      ...stickers("outro", 3),
    ],
  });

  return { pages, coverPhotoId: coverPhoto?.id ?? null };
}
