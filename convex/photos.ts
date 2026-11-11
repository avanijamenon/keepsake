import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { photoAnalysis, photoStorage } from "./schema";
import { requireRole, roleOrNull, atLeast } from "./lib/auth";
import { deleteRenditions, r2, r2Enabled, urlFor } from "./lib/storage";
import { adjustBytes, reserveUpload } from "./lib/quota";

const MAX_BYTES = 40 * 1024 * 1024;

/**
 * Step 1 of the ingestion flow: authorise and hand out upload targets for the
 * original, display and thumbnail renditions. With R2 these are presigned
 * PUT URLs under a key namespaced to the collection.
 */
export const generateUploadUrls = mutation({
  /** `bytes`: total size of the three renditions, for free-tier accounting. */
  args: { collectionId: v.id("collections"), bytes: v.number() },
  returns: v.union(
    v.object({
      provider: v.literal("r2"),
      original: v.object({ url: v.string(), key: v.string() }),
      display: v.object({ url: v.string(), key: v.string() }),
      thumb: v.object({ url: v.string(), key: v.string() }),
    }),
    v.object({
      provider: v.literal("convex"),
      original: v.string(),
      display: v.string(),
      thumb: v.string(),
    }),
  ),
  handler: async (ctx, { collectionId, bytes }) => {
    await requireRole(ctx, collectionId, "contributor");
    if (r2Enabled()) {
      if (!(bytes > 0) || bytes > MAX_BYTES * 1.5) throw new ConvexError("That photo is larger than 40MB.");
      await reserveUpload(ctx, bytes);
      const base = `c/${collectionId}/${crypto.randomUUID()}`;
      const [original, display, thumb] = await Promise.all(
        (["original", "display", "thumb"] as const).map((r) => r2().generateUploadUrl(`${base}/${r}`)),
      );
      return { provider: "r2" as const, original, display, thumb };
    }
    const [original, display, thumb] = await Promise.all([
      ctx.storage.generateUploadUrl(),
      ctx.storage.generateUploadUrl(),
      ctx.storage.generateUploadUrl(),
    ]);
    return { provider: "convex" as const, original, display, thumb };
  },
});

/** Cheap pre-check so the client can skip re-uploading exact duplicates. */
export const findBySha = query({
  args: { collectionId: v.id("collections"), sha256: v.string() },
  handler: async (ctx, { collectionId, sha256 }) => {
    const access = await roleOrNull(ctx, collectionId);
    if (!access || !atLeast(access.member.role, "contributor")) return null;
    const hit = await ctx.db
      .query("photos")
      .withIndex("by_collectionId_and_sha256", (q) =>
        q.eq("collectionId", collectionId).eq("sha256", sha256),
      )
      .first();
    return hit?._id ?? null;
  },
});

/** Step 2: record metadata once the renditions are stored. */
export const record = mutation({
  args: {
    collectionId: v.id("collections"),
    storage: photoStorage,
    fileName: v.string(),
    sha256: v.string(),
    width: v.number(),
    height: v.number(),
    takenAt: v.number(),
    takenAtSource: v.union(v.literal("exif"), v.literal("file"), v.literal("upload")),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    analysis: photoAnalysis,
    bytes: v.number(),
  },
  returns: v.object({ photoId: v.id("photos"), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, collection } = await requireRole(ctx, args.collectionId, "contributor");
    const storage = args.storage;
    if (storage.provider === "r2") {
      // Keys must be ones we minted for this collection.
      const prefix = `c/${args.collectionId}/`;
      if (![storage.original, storage.display, storage.thumb].every((k) => k.startsWith(prefix))) {
        throw new ConvexError("Upload doesn't belong to this memory box.");
      }
    } else {
      const meta = await ctx.db.system.get("_storage", storage.original);
      if (!meta) throw new ConvexError("Upload went missing — please try again.");
      if (meta.size > MAX_BYTES) {
        await deleteRenditions(ctx, storage);
        throw new ConvexError("That photo is larger than 40MB.");
      }
    }
    const dup = await ctx.db
      .query("photos")
      .withIndex("by_collectionId_and_sha256", (q) =>
        q.eq("collectionId", args.collectionId).eq("sha256", args.sha256),
      )
      .first();
    if (dup) {
      await deleteRenditions(ctx, storage);
      if (storage.provider === "r2") await adjustBytes(ctx, -args.bytes);
      return { photoId: dup._id, duplicate: true };
    }
    const photoId = await ctx.db.insert("photos", {
      collectionId: args.collectionId,
      contributorId: user._id,
      source: "upload",
      storage,
      fileName: args.fileName.slice(0, 200),
      sha256: args.sha256,
      width: args.width,
      height: args.height,
      takenAt: args.takenAt,
      takenAtSource: args.takenAtSource,
      location: args.location,
      favourite: false,
      bytes: args.bytes,
      analysis: args.analysis,
    });
    await ctx.db.patch("collections", args.collectionId, { photoCount: collection.photoCount + 1 });
    if (storage.provider === "r2") {
      // Presigned PUTs can't cap size, so check after the fact.
      await ctx.scheduler.runAfter(0, internal.photos.verifyUpload, { photoId });
    }
    return { photoId, duplicate: false };
  },
});

export const list = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const access = await roleOrNull(ctx, collectionId);
    if (!access || !atLeast(access.member.role, "contributor")) return [];
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_collectionId_and_takenAt", (q) => q.eq("collectionId", collectionId))
      .order("desc")
      .take(500);
    const contributors = new Map<string, { name: string; color: string }>();
    return await Promise.all(
      photos.map(async (p) => {
        if (!contributors.has(p.contributorId)) {
          const u = await ctx.db.get("users", p.contributorId);
          contributors.set(p.contributorId, { name: u?.name ?? "someone", color: u?.color ?? "#F7E88A" });
        }
        return {
          _id: p._id,
          thumbUrl: await urlFor(ctx, p.storage, "thumb"),
          width: p.width,
          height: p.height,
          takenAt: p.takenAt,
          favourite: p.favourite,
          fileName: p.fileName,
          contributor: contributors.get(p.contributorId)!,
          mine: p.contributorId === access.user._id,
          caption: p.ai?.caption,
        };
      }),
    );
  },
});

export const setFavourite = mutation({
  args: { photoId: v.id("photos"), favourite: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { photoId, favourite }) => {
    const photo = await ctx.db.get("photos", photoId);
    if (!photo) return null;
    await requireRole(ctx, photo.collectionId, "contributor");
    await ctx.db.patch("photos", photoId, { favourite });
    return null;
  },
});

/** User-initiated deletion: removes the record and every stored rendition. */
export const remove = mutation({
  args: { photoId: v.id("photos") },
  returns: v.null(),
  handler: async (ctx, { photoId }) => {
    const photo = await ctx.db.get("photos", photoId);
    if (!photo) return null;
    const { user, member, collection } = await requireRole(ctx, photo.collectionId, "contributor");
    if (photo.contributorId !== user._id && member.role !== "owner") {
      throw new ConvexError("Only the person who added a photo (or the owner) can remove it.");
    }
    await deleteRenditions(ctx, photo.storage);
    if (photo.storage.provider === "r2") await adjustBytes(ctx, -(photo.bytes ?? 0));
    await ctx.db.delete("photos", photoId);
    await ctx.db.patch("collections", photo.collectionId, {
      photoCount: Math.max(0, collection.photoCount - 1),
    });
    // Pages keep their slot but show an empty frame until replaced.
    return null;
  },
});

export const forAnalysis = internalQuery({
  args: { photoIds: v.array(v.id("photos")) },
  handler: async (ctx, { photoIds }) => {
    const rows = await Promise.all(photoIds.map((id) => ctx.db.get("photos", id)));
    return await Promise.all(
      rows
        .filter((p) => p !== null && !p.ai)
        .map(async (p) => ({
          _id: p!._id,
          takenAt: p!.takenAt,
          thumbUrl: await urlFor(ctx, p!.storage, "thumb"),
        })),
    );
  },
});

/** Confirms an R2 upload landed, is within the size limit, and records its true size. */
export const verifyUpload = internalAction({
  args: { photoId: v.id("photos") },
  returns: v.null(),
  handler: async (ctx, { photoId }) => {
    const storage = await ctx.runQuery(internal.photos.storageOf, { photoId });
    if (!storage || storage.provider !== "r2") return null;
    const keys = [storage.original, storage.display, storage.thumb];
    await Promise.all(keys.map((k) => r2().syncMetadata(ctx, k)));
    const metas = await Promise.all(keys.map((k) => r2().getMetadata(ctx, k)));
    const original = metas[0];
    if (!original || (original.size ?? 0) > MAX_BYTES) {
      console.warn("removing invalid upload", { photoId, size: original?.size ?? null });
      await ctx.runMutation(internal.photos.removeInvalid, { photoId });
      return null;
    }
    const actual = metas.reduce((sum, m) => sum + (m?.size ?? 0), 0);
    await ctx.runMutation(internal.photos.settleBytes, { photoId, actual });
    return null;
  },
});

export const settleBytes = internalMutation({
  args: { photoId: v.id("photos"), actual: v.number() },
  returns: v.null(),
  handler: async (ctx, { photoId, actual }) => {
    const photo = await ctx.db.get("photos", photoId);
    if (!photo) return null;
    await adjustBytes(ctx, actual - (photo.bytes ?? 0));
    await ctx.db.patch("photos", photoId, { bytes: actual });
    return null;
  },
});

export const storageOf = internalQuery({
  args: { photoId: v.id("photos") },
  handler: async (ctx, { photoId }) => (await ctx.db.get("photos", photoId))?.storage ?? null,
});

export const removeInvalid = internalMutation({
  args: { photoId: v.id("photos") },
  returns: v.null(),
  handler: async (ctx, { photoId }) => {
    const photo = await ctx.db.get("photos", photoId);
    if (!photo) return null;
    await deleteRenditions(ctx, photo.storage);
    if (photo.storage.provider === "r2") await adjustBytes(ctx, -(photo.bytes ?? 0));
    await ctx.db.delete("photos", photoId);
    const c = await ctx.db.get("collections", photo.collectionId);
    if (c) await ctx.db.patch("collections", c._id, { photoCount: Math.max(0, c.photoCount - 1) });
    return null;
  },
});
