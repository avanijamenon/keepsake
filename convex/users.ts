import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureViewer, getViewer } from "./lib/auth";

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
    return { _id: user._id, name: user.name, color: user.color, imageUrl: user.imageUrl };
  },
});
