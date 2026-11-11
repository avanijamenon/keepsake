import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMembership, getViewer, requireRole, requireViewer } from "./lib/auth";

function token() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const listInvites = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const user = await getViewer(ctx);
    if (!user) return [];
    const m = await getMembership(ctx, collectionId, user._id);
    if (m?.role !== "owner") return [];
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", collectionId))
      .take(20);
    return invites.filter((i) => !i.revoked).map((i) => ({ _id: i._id, token: i.token, role: i.role }));
  },
});

export const createInvite = mutation({
  args: {
    collectionId: v.id("collections"),
    role: v.union(v.literal("contributor"), v.literal("viewer")),
  },
  returns: v.string(),
  handler: async (ctx, { collectionId, role }) => {
    const { user } = await requireRole(ctx, collectionId, "owner");
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", collectionId))
      .take(20);
    const live = existing.find((i) => !i.revoked && i.role === role);
    if (live) return live.token;
    const t = token();
    await ctx.db.insert("invites", { collectionId, token: t, role, createdBy: user._id, revoked: false });
    return t;
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get("invites", inviteId);
    if (!invite) return null;
    await requireRole(ctx, invite.collectionId, "owner");
    await ctx.db.patch("invites", inviteId, { revoked: true });
    return null;
  },
});

export const peekInvite = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.revoked) return null;
    const collection = await ctx.db.get("collections", invite.collectionId);
    if (!collection) return null;
    const owner = await ctx.db.get("users", collection.ownerId);
    return {
      collectionName: collection.name,
      cover: collection.cover,
      role: invite.role,
      from: owner?.name ?? "a friend",
    };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  returns: v.id("collections"),
  handler: async (ctx, { token }) => {
    const user = await requireViewer(ctx);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.revoked) throw new ConvexError("This invite has expired.");
    const existing = await getMembership(ctx, invite.collectionId, user._id);
    if (!existing) {
      await ctx.db.insert("members", {
        collectionId: invite.collectionId,
        userId: user._id,
        role: invite.role,
      });
    } else if (existing.role === "viewer" && invite.role === "contributor") {
      await ctx.db.patch("members", existing._id, { role: "contributor" });
    }
    return invite.collectionId;
  },
});

export const setRole = mutation({
  args: {
    memberId: v.id("members"),
    role: v.union(v.literal("contributor"), v.literal("viewer")),
  },
  returns: v.null(),
  handler: async (ctx, { memberId, role }) => {
    const target = await ctx.db.get("members", memberId);
    if (!target) return null;
    await requireRole(ctx, target.collectionId, "owner");
    if (target.role === "owner") throw new ConvexError("The owner's role can't be changed.");
    await ctx.db.patch("members", memberId, { role });
    return null;
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const target = await ctx.db.get("members", memberId);
    if (!target) return null;
    const user = await requireViewer(ctx);
    const leavingSelf = target.userId === user._id;
    if (!leavingSelf) await requireRole(ctx, target.collectionId, "owner");
    if (target.role === "owner") throw new ConvexError("The owner can't leave their own box.");
    await ctx.db.delete("members", memberId);
    return null;
  },
});
