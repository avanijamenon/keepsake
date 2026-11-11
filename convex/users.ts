import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureViewer, FALLBACK_NAME, getViewer, requireViewer } from "./lib/auth";

/** Called once the client is authenticated, to create/refresh the profile. */
export const ensure = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => await ensureViewer(ctx),
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      color: user.color,
      imageUrl: user.imageUrl,
      needsName: !user.nameIsCustom && user.name === FALLBACK_NAME,
    };
  },
});

/** Lets someone choose what everyone in their boxes sees them as. */
export const setName = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const user = await requireViewer(ctx);
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!clean) throw new ConvexError("Your name can't be empty.");
    await ctx.db.patch("users", user._id, { name: clean, nameIsCustom: true });
    return null;
  },
});
