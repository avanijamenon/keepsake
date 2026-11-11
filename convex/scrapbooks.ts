import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { atLeast, requireRole, roleOrNull } from "./lib/auth";
import { THEME_IDS } from "./shared/themes";
import { urlFor } from "./lib/storage";

export const listForCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const access = await roleOrNull(ctx, collectionId);
    if (!access) return [];
    const books = await ctx.db
      .query("scrapbooks")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", collectionId))
      .order("desc")
      .take(60);
    const canSeeDrafts = atLeast(access.member.role, "contributor");
    return await Promise.all(
      books
        .filter((b) => canSeeDrafts || b.status === "published")
        .map(async (b) => {
          const cover = b.coverPhotoId ? await ctx.db.get("photos", b.coverPhotoId) : null;
          return {
            _id: b._id,
            title: b.title,
            subtitle: b.subtitle,
            theme: b.theme,
            status: b.status,
            pageCount: b.pageCount,
            periodStart: b.periodStart,
            coverUrl: cover ? await urlFor(ctx, cover.storage, "thumb") : null,
          };
        }),
    );
  },
});

/**
 * Full scrapbook with pages. Photo URLs are resolved server-side so viewers
 * only ever receive the photos placed on published pages.
 */
export const get = query({
  args: { scrapbookId: v.id("scrapbooks") },
  handler: async (ctx, { scrapbookId }) => {
    const book = await ctx.db.get("scrapbooks", scrapbookId);
    if (!book) return null;
    const access = await roleOrNull(ctx, book.collectionId);
    if (!access) return null;
    const canEdit = atLeast(access.member.role, "contributor");
    if (!canEdit && book.status !== "published") return null;

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_scrapbookId_and_order", (q) => q.eq("scrapbookId", scrapbookId))
      .take(200);
    const photoIds = new Set<Id<"photos">>();
    for (const p of pages)
      for (const el of p.elements) if (el.kind === "photo" && el.photoId) photoIds.add(el.photoId);
    const photos: Record<string, { url: string | null; thumbUrl: string | null; width: number; height: number }> = {};
    await Promise.all(
      [...photoIds].map(async (id) => {
        const p = await ctx.db.get("photos", id);
        if (!p) return;
        photos[id] = {
          url: await urlFor(ctx, p.storage, "display"),
          thumbUrl: await urlFor(ctx, p.storage, "thumb"),
          width: p.width,
          height: p.height,
        };
      }),
    );
    const collection = await ctx.db.get("collections", book.collectionId);
    return {
      _id: book._id,
      collectionId: book.collectionId,
      collectionName: collection?.name ?? "",
      title: book.title,
      subtitle: book.subtitle,
      theme: book.theme,
      status: book.status,
      role: access.member.role,
      canEdit,
      canPublish: access.member.role === "owner",
      pages: pages.map((p) => ({
        _id: p._id,
        order: p.order,
        template: p.template,
        paper: p.paper,
        elements: p.elements,
      })),
      photos,
    };
  },
});

export const updateMeta = mutation({
  args: {
    scrapbookId: v.id("scrapbooks"),
    title: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { scrapbookId, title, theme }) => {
    const book = await ctx.db.get("scrapbooks", scrapbookId);
    if (!book) throw new ConvexError("Scrapbook not found.");
    await requireRole(ctx, book.collectionId, "contributor");
    const patch: { title?: string; theme?: string } = {};
    if (title !== undefined) patch.title = title.trim().slice(0, 80) || book.title;
    if (theme !== undefined && THEME_IDS.includes(theme as never)) patch.theme = theme;
    await ctx.db.patch("scrapbooks", scrapbookId, patch);
    return null;
  },
});

export const setStatus = mutation({
  args: {
    scrapbookId: v.id("scrapbooks"),
    status: v.union(v.literal("draft"), v.literal("published")),
  },
  returns: v.null(),
  handler: async (ctx, { scrapbookId, status }) => {
    const book = await ctx.db.get("scrapbooks", scrapbookId);
    if (!book) throw new ConvexError("Scrapbook not found.");
    await requireRole(ctx, book.collectionId, "owner");
    await ctx.db.patch("scrapbooks", scrapbookId, {
      status,
      publishedAt: status === "published" ? Date.now() : undefined,
    });
    return null;
  },
});

export const remove = mutation({
  args: { scrapbookId: v.id("scrapbooks") },
  returns: v.null(),
  handler: async (ctx, { scrapbookId }) => {
    const book = await ctx.db.get("scrapbooks", scrapbookId);
    if (!book) return null;
    await requireRole(ctx, book.collectionId, "owner");
    for await (const page of ctx.db
      .query("pages")
      .withIndex("by_scrapbookId_and_order", (q) => q.eq("scrapbookId", scrapbookId))) {
      await ctx.db.delete("pages", page._id);
    }
    await ctx.db.delete("scrapbooks", scrapbookId);
    return null;
  },
});
