/**
 * Source-independent photo storage. Production uses Cloudflare R2 (signed,
 * expiring URLs); local development without credentials falls back to Convex
 * file storage. Every photo records which provider holds its renditions.
 */
import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";
import { env, type ActionCtx, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export type Rendition = "original" | "display" | "thumb";
type PhotoStorage = Doc<"photos">["storage"];

/** Signed URLs stay valid long enough for a reading session. */
const URL_TTL_SECONDS = 60 * 60 * 6;

let client: R2 | null = null;

export function r2Enabled() {
  return Boolean(env.R2_BUCKET && env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

export function r2() {
  if (!r2Enabled()) throw new Error("R2 is not configured");
  client ??= new R2(components.r2, {
    bucket: env.R2_BUCKET!,
    endpoint: env.R2_ENDPOINT!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  });
  return client;
}

export async function urlFor(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  storage: PhotoStorage,
  which: Rendition,
): Promise<string | null> {
  if (storage.provider === "r2") {
    return await r2().getUrl(storage[which], { expiresIn: URL_TTL_SECONDS });
  }
  return await ctx.storage.getUrl(storage[which]);
}

export async function deleteRenditions(ctx: MutationCtx, storage: PhotoStorage) {
  if (storage.provider === "r2") {
    await Promise.all([storage.original, storage.display, storage.thumb].map((k) => r2().deleteObject(ctx, k)));
  } else {
    await Promise.all([storage.original, storage.display, storage.thumb].map((id) => ctx.storage.delete(id)));
  }
}
