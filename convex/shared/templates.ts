/**
 * Page templates. Geometry is expressed in percentages of a 4:5 page so the
 * same spec renders identically on screen, in the editor and in exports.
 * Shared by the Convex layout engine and the React renderer.
 */

export type Frame = "polaroid" | "plain" | "deckled" | "round" | "stamp";

export type PhotoSlot = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  z: number;
  frame: Frame;
};

export type TextStyle = "title" | "subtitle" | "caption" | "label" | "handwritten";

export type TextSlot = {
  name: string;
  x: number;
  y: number;
  w: number;
  rotate: number;
  z: number;
  style: TextStyle;
  align: "left" | "center" | "right";
};

export type TemplateId =
  | "cover"
  | "hero"
  | "duo"
  | "polaroid-cluster"
  | "timeline"
  | "grid"
  | "scattered"
  | "collage"
  | "journal"
  | "outro";

export type Template = {
  id: TemplateId;
  label: string;
  blurb: string;
  photos: PhotoSlot[];
  texts: TextSlot[];
  /** Whether the engine may pick it for event pages. */
  body: boolean;
};

const p = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotate: number,
  z: number,
  frame: Frame,
): PhotoSlot => ({ name, x, y, w, h, rotate, z, frame });

const t = (
  name: string,
  x: number,
  y: number,
  w: number,
  style: TextStyle,
  align: TextSlot["align"] = "left",
  rotate = 0,
  z = 20,
): TextSlot => ({ name, x, y, w, rotate, z, style, align });

export const TEMPLATES: Record<TemplateId, Template> = {
  cover: {
    id: "cover",
    label: "Cover",
    blurb: "a big hello",
    body: false,
    photos: [p("hero", 17, 16, 66, 50, -3, 2, "polaroid")],
    texts: [
      t("kicker", 8, 6, 84, "label", "center"),
      t("title", 6, 72, 88, "title", "center"),
      t("subtitle", 12, 88, 76, "handwritten", "center", -2),
    ],
  },
  hero: {
    id: "hero",
    label: "Hero",
    blurb: "one photo, all the room",
    body: true,
    photos: [p("main", 0, 0, 100, 76, 0, 1, "plain")],
    texts: [
      t("title", 7, 80, 86, "subtitle"),
      t("caption", 7, 90, 70, "handwritten", "left", -1.5),
    ],
  },
  duo: {
    id: "duo",
    label: "Duo",
    blurb: "two that belong together",
    body: true,
    photos: [
      p("left", 6, 14, 50, 46, -4, 2, "polaroid"),
      p("right", 44, 38, 50, 46, 5, 3, "polaroid"),
    ],
    texts: [
      t("title", 7, 4, 80, "subtitle"),
      t("caption", 8, 88, 60, "handwritten", "left", -2),
    ],
  },
  "polaroid-cluster": {
    id: "polaroid-cluster",
    label: "Polaroid pile",
    blurb: "a little heap of prints",
    body: true,
    photos: [
      p("a", 6, 10, 46, 38, -6, 2, "polaroid"),
      p("b", 48, 18, 46, 38, 5, 3, "polaroid"),
      p("c", 22, 50, 48, 40, -1.5, 4, "polaroid"),
    ],
    texts: [
      t("title", 54, 4, 42, "subtitle", "right"),
      t("caption", 6, 91, 88, "handwritten", "center", -1),
    ],
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    blurb: "how the day went",
    body: true,
    photos: [
      p("first", 8, 12, 44, 25, -2, 2, "deckled"),
      p("second", 48, 38, 44, 25, 2, 2, "deckled"),
      p("third", 8, 65, 44, 25, -1, 2, "deckled"),
    ],
    texts: [
      t("title", 8, 3, 84, "subtitle"),
      t("t1", 56, 20, 36, "label"),
      t("t2", 8, 46, 36, "label", "right"),
      t("t3", 56, 73, 36, "label"),
    ],
  },
  grid: {
    id: "grid",
    label: "Contact sheet",
    blurb: "four, neatly",
    body: true,
    photos: [
      p("a", 7, 14, 42, 34, 0, 2, "plain"),
      p("b", 51, 14, 42, 34, 0, 2, "plain"),
      p("c", 7, 50, 42, 34, 0, 2, "plain"),
      p("d", 51, 50, 42, 34, 0, 2, "plain"),
    ],
    texts: [
      t("title", 7, 4, 86, "subtitle"),
      t("caption", 7, 88, 86, "label"),
    ],
  },
  scattered: {
    id: "scattered",
    label: "Scattered",
    blurb: "tipped out of the envelope",
    body: true,
    photos: [
      p("a", 4, 8, 38, 28, -8, 2, "polaroid"),
      p("b", 52, 4, 40, 30, 6, 3, "polaroid"),
      p("c", 26, 34, 44, 32, -2, 5, "polaroid"),
      p("d", 2, 62, 40, 30, 7, 4, "polaroid"),
      p("e", 56, 60, 40, 30, -5, 3, "polaroid"),
    ],
    texts: [t("caption", 30, 93, 64, "handwritten", "right", -2)],
  },
  collage: {
    id: "collage",
    label: "Collage",
    blurb: "cut, layered, stuck down",
    body: true,
    photos: [
      p("big", 5, 9, 60, 44, -2, 2, "plain"),
      p("tall", 60, 22, 35, 40, 4, 3, "stamp"),
      p("small", 10, 56, 34, 26, 5, 4, "round"),
      p("wide", 40, 62, 54, 28, -3, 3, "deckled"),
    ],
    texts: [
      t("title", 6, 2, 60, "subtitle"),
      t("caption", 6, 88, 40, "handwritten", "left", -3),
    ],
  },
  journal: {
    id: "journal",
    label: "Journal",
    blurb: "a photo and a few words",
    body: true,
    photos: [p("main", 34, 8, 60, 50, 3, 2, "polaroid")],
    texts: [
      t("date", 7, 9, 26, "label"),
      t("title", 7, 62, 86, "subtitle"),
      t("note", 7, 72, 86, "handwritten", "left", -1),
    ],
  },
  outro: {
    id: "outro",
    label: "The end",
    blurb: "a soft landing",
    body: false,
    photos: [],
    texts: [
      t("title", 10, 34, 80, "title", "center"),
      t("note", 14, 56, 72, "handwritten", "center", -2),
      t("label", 10, 86, 80, "label", "center"),
    ],
  },
};

export const BODY_TEMPLATES = Object.values(TEMPLATES).filter((tpl) => tpl.body);

export function templatesForPhotoCount(count: number): Template[] {
  return BODY_TEMPLATES.filter((tpl) => tpl.photos.length === count);
}
