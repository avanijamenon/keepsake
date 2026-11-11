/**
 * Narrowly scoped page edits. Each mutation touches one element of one page,
 * so two people editing different things never overwrite each other.
 */
import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole } from "./lib/auth";
import { TEMPLATES, type TemplateId } from "./shared/templates";
import { getTheme, STICKERS } from "./shared/themes";
import { SCHEMA_VERSION } from "./lib/layout";

type Element = Doc<"pages">["elements"][number];

async function editablePage(ctx: MutationCtx, pageId: Id<"pages">) {
  const page = await ctx.db.get("pages", pageId);
  if (!page) throw new ConvexError("That page was removed.");
  const book = await ctx.db.get("scrapbooks", page.scrapbookId);
  if (!book) throw new ConvexError("Scrapbook not found.");
  await requireRole(ctx, book.collectionId, "contributor");
  return { page, book };
}

async function patchElement(
  ctx: MutationCtx,
  pageId: Id<"pages">,
  elementId: string,
  fn: (el: Element) => Element,
) {
  const { page } = await editablePage(ctx, pageId);
  if (!page.elements.some((e) => e.id === elementId)) throw new ConvexError("That item was removed.");
  await ctx.db.patch("pages", pageId, {
    elements: page.elements.map((e) => (e.id === elementId ? fn(e) : e)),
  });
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const setText = mutation({
  args: { pageId: v.id("pages"), elementId: v.string(), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, elementId, content }) => {
    await patchElement(ctx, pageId, elementId, (el) =>
      el.kind === "text" ? { ...el, content: content.slice(0, 400) } : el,
    );
    return null;
  },
});

/** Sets text for a template slot, creating the element if it doesn't exist. */
export const setSlotText = mutation({
  args: { pageId: v.id("pages"), slot: v.string(), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, slot, content }) => {
    const { page } = await editablePage(ctx, pageId);
    const existing = page.elements.find((e) => e.kind === "text" && e.slot === slot);
    const text = content.slice(0, 400);
    await ctx.db.patch("pages", pageId, {
      elements: existing
        ? page.elements.map((e) => (e.id === existing.id ? { ...e, content: text } : e))
        : [...page.elements, { kind: "text", id: newId("tx"), slot, content: text }],
    });
    return null;
  },
});

export const setPhoto = mutation({
  args: { pageId: v.id("pages"), elementId: v.string(), photoId: v.union(v.id("photos"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { pageId, elementId, photoId }) => {
    const { book } = await editablePage(ctx, pageId);
    if (photoId) {
      const photo = await ctx.db.get("photos", photoId);
      if (!photo || photo.collectionId !== book.collectionId) {
        throw new ConvexError("That photo isn't in this memory box.");
      }
    }
    await patchElement(ctx, pageId, elementId, (el) => (el.kind === "photo" ? { ...el, photoId } : el));
    return null;
  },
});

export const rotate = mutation({
  args: { pageId: v.id("pages"), elementId: v.string(), rotation: v.number() },
  returns: v.null(),
  handler: async (ctx, { pageId, elementId, rotation }) => {
    await patchElement(ctx, pageId, elementId, (el) =>
      el.kind === "photo" || el.kind === "sticker" ? { ...el, rotation: clamp(rotation, -45, 45) } : el,
    );
    return null;
  },
});

/** Swap the photos in two slots on the same page. */
export const swapPhotos = mutation({
  args: { pageId: v.id("pages"), a: v.string(), b: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, a, b }) => {
    const { page } = await editablePage(ctx, pageId);
    const ea = page.elements.find((e) => e.id === a);
    const eb = page.elements.find((e) => e.id === b);
    if (ea?.kind !== "photo" || eb?.kind !== "photo") return null;
    await ctx.db.patch("pages", pageId, {
      elements: page.elements.map((e) =>
        e.id === a && e.kind === "photo"
          ? { ...e, photoId: eb.photoId }
          : e.id === b && e.kind === "photo"
            ? { ...e, photoId: ea.photoId }
            : e,
      ),
    });
    return null;
  },
});

export const addSticker = mutation({
  args: { pageId: v.id("pages"), sticker: v.string(), x: v.number(), y: v.number() },
  returns: v.string(),
  handler: async (ctx, { pageId, sticker, x, y }) => {
    if (!STICKERS.includes(sticker as never)) throw new ConvexError("Unknown sticker.");
    const { page } = await editablePage(ctx, pageId);
    if (page.elements.filter((e) => e.kind === "sticker").length >= 12) {
      throw new ConvexError("That page is full of stickers already!");
    }
    const id = newId("st");
    await ctx.db.patch("pages", pageId, {
      elements: [
        ...page.elements,
        {
          kind: "sticker",
          id,
          sticker,
          x: clamp(x, 0, 100),
          y: clamp(y, 0, 100),
          rotation: Math.round((Math.random() - 0.5) * 30),
          scale: 1,
        },
      ],
    });
    return id;
  },
});

export const moveSticker = mutation({
  args: {
    pageId: v.id("pages"),
    elementId: v.string(),
    x: v.number(),
    y: v.number(),
    scale: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { pageId, elementId, x, y, scale }) => {
    await patchElement(ctx, pageId, elementId, (el) =>
      el.kind === "sticker"
        ? { ...el, x: clamp(x, 0, 100), y: clamp(y, 0, 100), scale: clamp(scale ?? el.scale, 0.4, 2.5) }
        : el,
    );
    return null;
  },
});

export const removeElement = mutation({
  args: { pageId: v.id("pages"), elementId: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, elementId }) => {
    const { page } = await editablePage(ctx, pageId);
    const el = page.elements.find((e) => e.id === elementId);
    if (!el) return null;
    // Photo slots belong to the template — clear them instead of deleting.
    await ctx.db.patch("pages", pageId, {
      elements:
        el.kind === "photo"
          ? page.elements.map((e) => (e.id === elementId && e.kind === "photo" ? { ...e, photoId: null } : e))
          : page.elements.filter((e) => e.id !== elementId),
    });
    return null;
  },
});

/** Switch template, carrying photos and text over to the new slots. */
export const setTemplate = mutation({
  args: { pageId: v.id("pages"), template: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, template }) => {
    const tpl = TEMPLATES[template as TemplateId];
    if (!tpl) throw new ConvexError("Unknown layout.");
    const { page } = await editablePage(ctx, pageId);
    const photos = page.elements.filter((e) => e.kind === "photo").map((e) => e.photoId).filter((id) => id);
    const texts = new Map(
      page.elements.filter((e) => e.kind === "text").map((e) => [e.slot, e.content] as const),
    );
    const leftovers = [...texts.values()].filter((t) => t);
    const elements: Element[] = [
      ...tpl.photos.map((slot, i) => ({
        kind: "photo" as const,
        id: newId("ph"),
        slot: slot.name,
        photoId: photos[i] ?? null,
        rotation: slot.rotate,
      })),
      ...tpl.texts.map((slot) => ({
        kind: "text" as const,
        id: newId("tx"),
        slot: slot.name,
        content: texts.get(slot.name) ?? (slot.name === "title" || slot.name === "caption" ? (leftovers.shift() ?? "") : ""),
      })),
      ...page.elements.filter((e) => e.kind === "sticker"),
    ];
    await ctx.db.patch("pages", pageId, { template, elements });
    return null;
  },
});

export const setPaper = mutation({
  args: { pageId: v.id("pages"), paper: v.string() },
  returns: v.null(),
  handler: async (ctx, { pageId, paper }) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(paper)) throw new ConvexError("Invalid colour.");
    await editablePage(ctx, pageId);
    await ctx.db.patch("pages", pageId, { paper });
    return null;
  },
});

export const addPage = mutation({
  args: { afterPageId: v.id("pages"), template: v.string() },
  returns: v.id("pages"),
  handler: async (ctx, { afterPageId, template }) => {
    const tpl = TEMPLATES[template as TemplateId];
    if (!tpl) throw new ConvexError("Unknown layout.");
    const { page, book } = await editablePage(ctx, afterPageId);
    const next = await ctx.db
      .query("pages")
      .withIndex("by_scrapbookId_and_order", (q) =>
        q.eq("scrapbookId", page.scrapbookId).gt("order", page.order),
      )
      .first();
    const order = next ? (page.order + next.order) / 2 : page.order + 1;
    const theme = getTheme(book.theme);
    const id = await ctx.db.insert("pages", {
      scrapbookId: page.scrapbookId,
      order,
      template,
      paper: theme.papers[Math.floor(order) % theme.papers.length],
      elements: [
        ...tpl.photos.map((slot) => ({
          kind: "photo" as const,
          id: newId("ph"),
          slot: slot.name,
          photoId: null,
          rotation: slot.rotate,
        })),
        ...tpl.texts.map((slot) => ({ kind: "text" as const, id: newId("tx"), slot: slot.name, content: "" })),
      ],
      schemaVersion: SCHEMA_VERSION,
    });
    await ctx.db.patch("scrapbooks", book._id, { pageCount: book.pageCount + 1 });
    return id;
  },
});

export const removePage = mutation({
  args: { pageId: v.id("pages") },
  returns: v.null(),
  handler: async (ctx, { pageId }) => {
    const { page, book } = await editablePage(ctx, pageId);
    if (page.template === "cover") throw new ConvexError("Every scrapbook needs its cover.");
    await ctx.db.delete("pages", pageId);
    await ctx.db.patch("scrapbooks", book._id, { pageCount: Math.max(1, book.pageCount - 1) });
    return null;
  },
});

export const movePage = mutation({
  args: { pageId: v.id("pages"), direction: v.union(v.literal(-1), v.literal(1)) },
  returns: v.null(),
  handler: async (ctx, { pageId, direction }) => {
    const { page } = await editablePage(ctx, pageId);
    if (page.template === "cover") return null;
    const neighbour = await ctx.db
      .query("pages")
      .withIndex("by_scrapbookId_and_order", (q) =>
        direction === 1
          ? q.eq("scrapbookId", page.scrapbookId).gt("order", page.order)
          : q.eq("scrapbookId", page.scrapbookId).lt("order", page.order),
      )
      .order(direction === 1 ? "asc" : "desc")
      .first();
    if (!neighbour || neighbour.template === "cover") return null;
    await ctx.db.patch("pages", pageId, { order: neighbour.order });
    await ctx.db.patch("pages", neighbour._id, { order: page.order });
    return null;
  },
});
