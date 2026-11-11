/**
 * Photo curation: duplicates, quality, event grouping and a balanced
 * selection. Pure functions — no database access — so the pipeline is easy to
 * test and to swap pieces of (e.g. embeddings instead of dHash).
 */

export type CurationInput = {
  id: string;
  takenAt: number;
  favourite: boolean;
  sha256: string;
  analysis: {
    dhash: string;
    sharpness: number;
    brightness: number;
    contrast: number;
    colorfulness: number;
    quality: number;
  };
  ai?: { interest: number; description: string };
};

export type Decision = "selected" | "duplicate" | "low_quality" | "not_chosen";

export type CurationResult = {
  candidates: {
    photoId: string;
    decision: Decision;
    reason: string;
    score: number;
    event: number;
    duplicateOf?: string;
    pinned: boolean;
  }[];
  events: { index: number; start: number; end: number; label: string }[];
};

const NEAR_DUP_BITS = 6; // of 64 — visually the same frame
const BURST_DUP_BITS = 11; // looser when shot within a couple of minutes
const BURST_WINDOW_MS = 3 * 60 * 1000;
const EVENT_GAP_MS = 3 * 60 * 60 * 1000;

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Technical quality is only part of it — interest and favourites weigh in. */
export function scorePhoto(p: CurationInput): number {
  const interest = p.ai
    ? p.ai.interest
    : 0.5 * p.analysis.colorfulness + 0.5 * p.analysis.contrast;
  const base = 0.45 * p.analysis.quality + 0.55 * interest;
  return Math.round((base + (p.favourite ? 1 : 0)) * 1000) / 1000;
}

function partOfDay(d: Date, tz: number) {
  const h = new Date(d.getTime() - tz * 60000).getUTCHours();
  if (h < 5) return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Labels are grounded purely in timestamps — nothing invented. */
export function eventLabel(start: number, end: number, tzOffsetMinutes: number) {
  const s = new Date(start - tzOffsetMinutes * 60000);
  const e = new Date(end - tzOffsetMinutes * 60000);
  const sameDay = s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10);
  const day = `${WEEKDAYS[s.getUTCDay()]} ${partOfDay(new Date(start), tzOffsetMinutes)}`;
  if (sameDay) return day;
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`;
}

export function targetCount(n: number) {
  if (n <= 8) return n;
  return Math.min(28, Math.max(8, Math.round(n * 0.55)));
}

export function curate(
  photos: CurationInput[],
  opts: { tzOffsetMinutes: number; pinned: Set<string> },
): CurationResult {
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const score = new Map(sorted.map((p) => [p.id, scorePhoto(p)]));
  const isPinned = (p: CurationInput) => p.favourite || opts.pinned.has(p.id);

  // 1. Events: split on long gaps in capture time.
  const eventOf = new Map<string, number>();
  const events: CurationResult["events"] = [];
  let current: CurationInput[] = [];
  const flush = () => {
    if (!current.length) return;
    const index = events.length;
    const start = current[0].takenAt;
    const end = current[current.length - 1].takenAt;
    events.push({ index, start, end, label: eventLabel(start, end, opts.tzOffsetMinutes) });
    for (const p of current) eventOf.set(p.id, index);
    current = [];
  };
  for (const p of sorted) {
    const prev = current[current.length - 1];
    if (prev && p.takenAt - prev.takenAt > EVENT_GAP_MS) flush();
    current.push(p);
  }
  flush();

  // 2. Duplicates: union near-identical frames, keep the best of each set.
  const parent = new Map(sorted.map((p) => [p.id, p.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (eventOf.get(a.id) !== eventOf.get(b.id)) break;
      const dist = hamming(a.analysis.dhash, b.analysis.dhash);
      const burst = Math.abs(b.takenAt - a.takenAt) <= BURST_WINDOW_MS;
      if (a.sha256 === b.sha256 || dist <= NEAR_DUP_BITS || (burst && dist <= BURST_DUP_BITS)) {
        parent.set(find(b.id), find(a.id));
      }
    }
  }
  const groups = new Map<string, CurationInput[]>();
  for (const p of sorted) {
    const root = find(p.id);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }

  const out = new Map<string, CurationResult["candidates"][number]>();
  const pool: CurationInput[] = [];
  for (const members of groups.values()) {
    const best = [...members].sort(
      (a, b) => Number(isPinned(b)) - Number(isPinned(a)) || score.get(b.id)! - score.get(a.id)!,
    )[0];
    pool.push(best);
    for (const m of members) {
      if (m.id === best.id) continue;
      if (isPinned(m)) {
        pool.push(m);
        continue;
      }
      out.set(m.id, {
        photoId: m.id,
        decision: "duplicate",
        reason:
          m.sha256 === best.sha256
            ? "exact copy of another photo"
            : "near-identical to a sharper or brighter take",
        score: score.get(m.id)!,
        event: eventOf.get(m.id)!,
        duplicateOf: best.id,
        pinned: false,
      });
    }
  }

  // 3. Quality floor — only enforced when there's enough else to choose from.
  const target = targetCount(pool.length);
  const weak = (p: CurationInput) => p.analysis.quality < 0.28 && !isPinned(p);
  const strongCount = pool.filter((p) => !weak(p)).length;
  const eligible: CurationInput[] = [];
  for (const p of pool) {
    if (weak(p) && strongCount >= target) {
      const a = p.analysis;
      out.set(p.id, {
        photoId: p.id,
        decision: "low_quality",
        reason:
          a.brightness < 0.2
            ? "too dark to make out"
            : a.brightness > 0.9
              ? "washed out"
              : a.sharpness < 0.25
                ? "a little blurry"
                : "not quite in focus",
        score: score.get(p.id)!,
        event: eventOf.get(p.id)!,
        pinned: false,
      });
    } else {
      eligible.push(p);
    }
  }

  // 4. Balanced selection: pins first, then a per-event share, then the best
  //    of what's left — with a penalty for looking like something already in.
  const chosen = new Set<string>();
  const reason = new Map<string, string>();
  for (const p of eligible) {
    if (isPinned(p)) {
      chosen.add(p.id);
      reason.set(p.id, p.favourite ? "a favourite — always in" : "you pinned this one");
    }
  }
  const byEvent = new Map<number, CurationInput[]>();
  for (const p of eligible) {
    const e = eventOf.get(p.id)!;
    byEvent.set(e, [...(byEvent.get(e) ?? []), p]);
  }
  const diversityPenalty = (p: CurationInput) => {
    let penalty = 0;
    for (const id of chosen) {
      const other = eligible.find((x) => x.id === id);
      if (!other || eventOf.get(other.id) !== eventOf.get(p.id)) continue;
      const d = hamming(p.analysis.dhash, other.analysis.dhash);
      if (d < 18) penalty += (18 - d) / 60;
    }
    return penalty;
  };
  const pickFrom = (list: CurationInput[]) =>
    list
      .filter((p) => !chosen.has(p.id))
      .map((p) => ({ p, s: score.get(p.id)! - diversityPenalty(p) }))
      .sort((a, b) => b.s - a.s)[0]?.p;

  const total = eligible.length || 1;
  for (const [e, list] of byEvent) {
    const share = Math.max(1, Math.round((list.length / total) * target));
    let have = list.filter((p) => chosen.has(p.id)).length;
    while (have < share && chosen.size < target) {
      const next = pickFrom(list);
      if (!next) break;
      chosen.add(next.id);
      reason.set(next.id, `one of the best from ${events[e].label}`);
      have++;
    }
  }
  while (chosen.size < target) {
    const next = pickFrom(eligible);
    if (!next) break;
    chosen.add(next.id);
    reason.set(next.id, "a lovely extra");
  }

  for (const p of eligible) {
    out.set(p.id, {
      photoId: p.id,
      decision: chosen.has(p.id) ? "selected" : "not_chosen",
      reason: chosen.has(p.id)
        ? (reason.get(p.id) ?? "chosen")
        : "set aside to keep things varied",
      score: score.get(p.id)!,
      event: eventOf.get(p.id)!,
      pinned: isPinned(p),
    });
  }

  return {
    candidates: sorted.map((p) => out.get(p.id)!),
    events,
  };
}
