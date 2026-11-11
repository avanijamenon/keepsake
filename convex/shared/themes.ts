/**
 * Scrapbook colour personalities. Each theme supplies paper colours for
 * alternating pages, an accent, and the blurred "light leak" blobs that sit
 * behind pages and covers.
 */

export type ThemeId =
  | "sunny-afternoon"
  | "bubblegum"
  | "pistachio-garden"
  | "seaside"
  | "tomato-picnic"
  | "film-night";

export type Theme = {
  id: ThemeId;
  label: string;
  papers: string[];
  ink: string;
  accent: string;
  blobs: string[];
  tape: string[];
};

export const THEMES: Record<ThemeId, Theme> = {
  "sunny-afternoon": {
    id: "sunny-afternoon",
    label: "Sunny afternoon",
    papers: ["#FAF5E9", "#FBF0C9", "#FFE7DA"],
    ink: "#292620",
    accent: "#EF6956",
    blobs: ["#F7E88A", "#FFB89A", "#EF6956"],
    tape: ["#F7E88A", "#FFB89A"],
  },
  bubblegum: {
    id: "bubblegum",
    label: "Bubblegum",
    papers: ["#FCEFF5", "#EFEAFD", "#FAF5E9"],
    ink: "#2B2232",
    accent: "#E0569B",
    blobs: ["#F5A9D0", "#B7AAF2", "#FFB89A"],
    tape: ["#F5A9D0", "#B7AAF2"],
  },
  "pistachio-garden": {
    id: "pistachio-garden",
    label: "Pistachio garden",
    papers: ["#F2F5E6", "#FAF5E9", "#E8F0DA"],
    ink: "#262A1B",
    accent: "#64683C",
    blobs: ["#C4DBA5", "#F7E88A", "#A9D8F2"],
    tape: ["#C4DBA5", "#F7E88A"],
  },
  seaside: {
    id: "seaside",
    label: "Seaside",
    papers: ["#EEF6FB", "#FAF5E9", "#E6F0F8"],
    ink: "#1F2933",
    accent: "#2F6FDB",
    blobs: ["#A9D8F2", "#B7AAF2", "#F7E88A"],
    tape: ["#A9D8F2", "#F7E88A"],
  },
  "tomato-picnic": {
    id: "tomato-picnic",
    label: "Tomato picnic",
    papers: ["#FFF3EC", "#FAF5E9", "#FDE9E3"],
    ink: "#2A1F1C",
    accent: "#D9442F",
    blobs: ["#EF6956", "#FFB89A", "#C4DBA5"],
    tape: ["#EF6956", "#FAF5E9"],
  },
  "film-night": {
    id: "film-night",
    label: "Film night",
    papers: ["#2E2C25", "#35322A", "#29271F"],
    ink: "#F5EEDC",
    accent: "#F7E88A",
    blobs: ["#64683C", "#B7AAF2", "#EF6956"],
    tape: ["#F7E88A", "#B7AAF2"],
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function getTheme(id: string | undefined | null): Theme {
  return THEMES[(id ?? "") as ThemeId] ?? THEMES["sunny-afternoon"];
}

export const STICKERS = [
  "flower",
  "daisy",
  "sparkle",
  "star",
  "heart",
  "sun",
  "mushroom",
  "cloud",
  "arrow",
  "tape",
  "cherry",
  "moon",
] as const;

export type StickerId = (typeof STICKERS)[number];
