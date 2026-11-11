import { ConvexError } from "convex/values";
import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const DEV_TOKEN = "dev|local-keepsaker";

type Role = Doc<"members">["role"];
const RANK: Record<Role, number> = { viewer: 0, contributor: 1, owner: 2 };

const COLORS = ["#F7E88A", "#FFB89A", "#F5A9D0", "#B7AAF2", "#C4DBA5", "#A9D8F2"];

/** Resolves the caller's identity: Clerk JWT, or the local dev bypass. */
async function identity(ctx: QueryCtx | MutationCtx) {
  const id = await ctx.auth.getUserIdentity();
  if (id) {
    return {
      tokenIdentifier: id.tokenIdentifier,
      name: id.name ?? id.givenName ?? id.nickname ?? "friend",
      imageUrl: id.pictureUrl,
    };
  }
  if (env.DEV_AUTH_BYPASS === "true" && !env.CLERK_JWT_ISSUER_DOMAIN) {
    return { tokenIdentifier: DEV_TOKEN, name: "you", imageUrl: undefined };
  }
  return null;
}

export async function getViewer(ctx: QueryCtx | MutationCtx) {
  const id = await identity(ctx);
  if (!id) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", id.tokenIdentifier))
    .unique();
}

export async function requireViewer(ctx: QueryCtx | MutationCtx) {
  const user = await getViewer(ctx);
  if (!user) throw new ConvexError("Please sign in first.");
  return user;
}

/** Creates or refreshes the users row for the caller. */
export async function ensureViewer(ctx: MutationCtx): Promise<Id<"users">> {
  const id = await identity(ctx);
  if (!id) throw new ConvexError("Please sign in first.");
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", id.tokenIdentifier))
    .unique();
  if (existing) {
    if (existing.name !== id.name || existing.imageUrl !== id.imageUrl) {
      await ctx.db.patch("users", existing._id, { name: id.name, imageUrl: id.imageUrl });
    }
    return existing._id;
  }
  let hash = 0;
  for (const ch of id.tokenIdentifier) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return await ctx.db.insert("users", {
    tokenIdentifier: id.tokenIdentifier,
    name: id.name,
    imageUrl: id.imageUrl,
    color: COLORS[Math.abs(hash) % COLORS.length],
  });
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("members")
    .withIndex("by_collectionId_and_userId", (q) =>
      q.eq("collectionId", collectionId).eq("userId", userId),
    )
    .unique();
}

/**
 * Throws unless the caller holds at least `min` in the collection.
 * Returns the user, membership and collection for convenience.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  collectionId: Id<"collections">,
  min: Role,
) {
  const user = await requireViewer(ctx);
  const collection = await ctx.db.get("collections", collectionId);
  const member = collection ? await getMembership(ctx, collectionId, user._id) : null;
  if (!collection || !member) throw new ConvexError("That memory box isn't shared with you.");
  if (RANK[member.role] < RANK[min]) {
    throw new ConvexError(`You need to be a ${min} to do that.`);
  }
  return { user, member, collection };
}

/** Like requireRole but returns null instead of throwing (for queries). */
export async function roleOrNull(
  ctx: QueryCtx | MutationCtx,
  collectionId: Id<"collections">,
) {
  const user = await getViewer(ctx);
  if (!user) return null;
  const member = await getMembership(ctx, collectionId, user._id);
  return member ? { user, member } : null;
}

export function atLeast(role: Role, min: Role) {
  return RANK[role] >= RANK[min];
}
