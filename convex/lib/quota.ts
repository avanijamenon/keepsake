/**
 * Keeps R2 strictly inside Cloudflare's free tier. Cloudflare has no hard
 * spending cap, so the app enforces one: uploads are refused before stored
 * bytes or monthly writes reach the free allowance (with headroom).
 */
import { ConvexError } from "convex/values";
import { env, type MutationCtx } from "../_generated/server";

const KEY = "r2";
const DEFAULT_MAX_GB = 9; // free tier is 10 GB
const DEFAULT_MAX_WRITES = 900_000; // free tier is 1M Class A ops / month
export const WRITES_PER_PHOTO = 3; // original + display + thumb

function limits() {
  const gb = Number(env.R2_MAX_GB ?? DEFAULT_MAX_GB);
  const writes = Number(env.R2_MAX_WRITES_PER_MONTH ?? DEFAULT_MAX_WRITES);
  return {
    maxBytes: (Number.isFinite(gb) && gb > 0 ? gb : DEFAULT_MAX_GB) * 1024 ** 3,
    maxWrites: Number.isFinite(writes) && writes > 0 ? writes : DEFAULT_MAX_WRITES,
  };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function usageDoc(ctx: MutationCtx) {
  const doc = await ctx.db.query("usage").withIndex("by_key", (q) => q.eq("key", KEY)).unique();
  if (doc) {
    if (doc.month !== currentMonth()) {
      await ctx.db.patch("usage", doc._id, { month: currentMonth(), writes: 0 });
      return { ...doc, month: currentMonth(), writes: 0 };
    }
    return doc;
  }
  const id = await ctx.db.insert("usage", { key: KEY, bytes: 0, month: currentMonth(), writes: 0 });
  return (await ctx.db.get("usage", id))!;
}

/** Called before handing out upload URLs. Throws if the free tier would be exceeded. */
export async function reserveUpload(ctx: MutationCtx, bytes: number) {
  const { maxBytes, maxWrites } = limits();
  const u = await usageDoc(ctx);
  if (u.writes + WRITES_PER_PHOTO > maxWrites) {
    throw new ConvexError("Uploads are paused until next month to stay within the free plan.");
  }
  if (u.bytes + bytes > maxBytes) {
    throw new ConvexError("The photo space is full (free plan limit). Remove some photos to add more.");
  }
  // Writes are counted now: the PUTs happen whether or not the photo is kept.
  await ctx.db.patch("usage", u._id, { writes: u.writes + WRITES_PER_PHOTO, bytes: u.bytes + bytes });
}

/** Adjust stored bytes (negative to release space). */
export async function adjustBytes(ctx: MutationCtx, delta: number) {
  if (!delta) return;
  const u = await usageDoc(ctx);
  await ctx.db.patch("usage", u._id, { bytes: Math.max(0, u.bytes + delta) });
}
