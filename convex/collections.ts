import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { frequency } from "./schema";
import { atLeast, getViewer, requireRole, requireViewer } from "./lib/auth";
import { THEME_IDS } from "./shared/themes";
import { urlFor } from "./lib/storage";

const COVERS = ["butter", "peach", "bubblegum", "lavender", "pistachio", "sky", "tomato"];

async function previewUrls(ctx: QueryCtx, collection: Doc<"collections">, take: number) {
  const photos = await ctx.db
    .query("photos")
    .withIndex("by_collectionId_and_takenAt", (q) => q.eq("collectionId", collection._id))
    .order("desc")
    .take(take);
  const urls = await Promise.all(photos.map((p) => urlFor(ctx, p.storage, "thumb")));
  return urls.filter((u): u is string => u !== null);
}

/** The home "shelf": every box I belong to, with a few peeks inside. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return [];
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);
    const result = await Promise.all(
      memberships.map(async (m) => {
        const c = await ctx.db.get("collections", m.collectionId);
        if (!c) return null;
        const canSeePhotos = atLeast(m.role, "contributor");
        const books = await ctx.db
          .query("scrapbooks")
          .withIndex("by_collectionId", (q) => q.eq("collectionId", c._id))
          .order("desc")
          .take(20);
        const visibleBooks = books.filter((b) => canSeePhotos || b.status === "published");
        const memberRows = await ctx.db
          .query("members")
          .withIndex("by_collectionId_and_userId", (q) => q.eq("collectionId", c._id))
          .take(8);
        const people = await Promise.all(memberRows.map((r) => ctx.db.get("users", r.userId)));
        return {
          _id: c._id,
          name: c.name,
          description: c.description,
          cover: c.cover,
          theme: c.theme,
          frequency: c.frequency,
          photoCount: c.photoCount,
          role: m.role,
          previews: canSeePhotos ? await previewUrls(ctx, c, 4) : [],
          people: people.filter((p) => p !== null).map((p) => ({ name: p.name, color: p.color })),
          scrapbooks: await Promise.all(
            visibleBooks.slice(0, 6).map(async (b) => {
              const cover = b.coverPhotoId ? await ctx.db.get("photos", b.coverPhotoId) : null;
              return {
                _id: b._id,
                title: b.title,
                subtitle: b.subtitle,
                theme: b.theme,
                status: b.status,
                pageCount: b.pageCount,
                coverUrl: cover ? await urlFor(ctx, cover.storage, "thumb") : null,
              };
            }),
          ),
          _creationTime: c._creationTime,
        };
      }),
    );
    return result
      .filter((r) => r !== null)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const get = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    const c = await ctx.db.get("collections", collectionId);
    if (!c) return null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_collectionId_and_userId", (q) =>
        q.eq("collectionId", collectionId).eq("userId", user._id),
      )
      .unique();
    if (!member) return null;
    const memberRows = await ctx.db
      .query("members")
      .withIndex("by_collectionId_and_userId", (q) => q.eq("collectionId", collectionId))
      .take(50);
    const members = await Promise.all(
      memberRows.map(async (m) => {
        const u = await ctx.db.get("users", m.userId);
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          name: u?.name ?? "someone",
          color: u?.color ?? "#F7E88A",
          isMe: m.userId === user._id,
        };
      }),
    );
    return {
      _id: c._id,
      name: c.name,
      description: c.description,
      frequency: c.frequency,
      theme: c.theme,
      cover: c.cover,
      photoCount: c.photoCount,
      role: member.role,
      members,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    frequency,
    theme: v.optional(v.string()),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const user = await requireViewer(ctx);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new ConvexError("Give your memory box a name.");
    const theme = args.theme && THEME_IDS.includes(args.theme as never)
      ? args.theme
      : THEME_IDS[Math.floor(Math.random() * 5)];
    const id = await ctx.db.insert("collections", {
      name,
      description: args.description?.trim().slice(0, 280) || undefined,
      ownerId: user._id,
      frequency: args.frequency,
      theme,
      cover: COVERS[Math.floor(Math.random() * COVERS.length)],
      photoCount: 0,
    });
    await ctx.db.insert("members", { collectionId: id, userId: user._id, role: "owner" });
    return id;
  },
});

export const update = mutation({
  args: {
    collectionId: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    frequency: v.optional(frequency),
    theme: v.optional(v.string()),
    cover: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { collectionId, ...patch }) => {
    await requireRole(ctx, collectionId, "owner");
    const clean: Partial<Doc<"collections">> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, 80);
      if (!name) throw new ConvexError("A memory box needs a name.");
      clean.name = name;
    }
    if (patch.description !== undefined) clean.description = patch.description.trim().slice(0, 280);
    if (patch.frequency !== undefined) clean.frequency = patch.frequency;
    if (patch.theme !== undefined && THEME_IDS.includes(patch.theme as never)) clean.theme = patch.theme;
    if (patch.cover !== undefined && COVERS.includes(patch.cover)) clean.cover = patch.cover;
    await ctx.db.patch("collections", collectionId, clean);
    return null;
  },
});
