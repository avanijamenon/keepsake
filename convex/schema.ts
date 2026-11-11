import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(
  v.literal("owner"),
  v.literal("contributor"),
  v.literal("viewer"),
);

export const frequency = v.union(
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("manual"),
);

export const photoAnalysis = v.object({
  dhash: v.string(),
  sharpness: v.number(),
  brightness: v.number(),
  contrast: v.number(),
  colorfulness: v.number(),
  quality: v.number(),
  dominant: v.string(),
});

export const aiAnalysis = v.object({
  interest: v.number(),
  description: v.string(),
  caption: v.string(),
  tags: v.array(v.string()),
  model: v.string(),
});

/** Source-independent photo storage reference: R2 object keys or Convex files. */
export const photoStorage = v.union(
  v.object({
    provider: v.literal("r2"),
    original: v.string(),
    display: v.string(),
    thumb: v.string(),
  }),
  v.object({
    provider: v.literal("convex"),
    original: v.id("_storage"),
    display: v.id("_storage"),
    thumb: v.id("_storage"),
  }),
);

export const pageElement = v.union(
  v.object({
    kind: v.literal("photo"),
    id: v.string(),
    slot: v.string(),
    photoId: v.union(v.id("photos"), v.null()),
    rotation: v.number(),
    caption: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("text"),
    id: v.string(),
    slot: v.string(),
    content: v.string(),
  }),
  v.object({
    kind: v.literal("sticker"),
    id: v.string(),
    sticker: v.string(),
    x: v.number(),
    y: v.number(),
    rotation: v.number(),
    scale: v.number(),
  }),
);

export const candidateDecision = v.union(
  v.literal("selected"),
  v.literal("duplicate"),
  v.literal("low_quality"),
  v.literal("not_chosen"),
);

export default defineSchema({
  /** Running totals that keep R2 inside its free tier. */
  usage: defineTable({
    key: v.string(),
    bytes: v.number(),
    month: v.string(),
    writes: v.number(),
  }).index("by_key", ["key"]),

  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    /** True once the person picked their own name; sign-in data won't overwrite it. */
    nameIsCustom: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    color: v.string(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  collections: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    frequency,
    theme: v.string(),
    cover: v.string(),
    photoCount: v.number(),
  }),

  members: defineTable({
    collectionId: v.id("collections"),
    userId: v.id("users"),
    role,
  })
    .index("by_collectionId_and_userId", ["collectionId", "userId"])
    .index("by_userId", ["userId"]),

  invites: defineTable({
    collectionId: v.id("collections"),
    token: v.string(),
    role: v.union(v.literal("contributor"), v.literal("viewer")),
    createdBy: v.id("users"),
    revoked: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_collectionId", ["collectionId"]),

  photos: defineTable({
    collectionId: v.id("collections"),
    contributorId: v.id("users"),
    source: v.union(
      v.literal("upload"),
      v.literal("google_photos"),
      v.literal("ios"),
    ),
    storage: photoStorage,
    fileName: v.string(),
    sha256: v.string(),
    width: v.number(),
    height: v.number(),
    takenAt: v.number(),
    takenAtSource: v.union(v.literal("exif"), v.literal("file"), v.literal("upload")),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    favourite: v.boolean(),
    /** Bytes stored across all renditions (R2 quota accounting). */
    bytes: v.optional(v.number()),
    analysis: photoAnalysis,
    ai: v.optional(aiAnalysis),
  })
    .index("by_collectionId_and_takenAt", ["collectionId", "takenAt"])
    .index("by_collectionId_and_sha256", ["collectionId", "sha256"]),

  generationJobs: defineTable({
    collectionId: v.id("collections"),
    requestedBy: v.id("users"),
    periodStart: v.number(),
    periodEnd: v.number(),
    label: v.string(),
    tzOffsetMinutes: v.number(),
    status: v.union(
      v.literal("curating"),
      v.literal("analysing"),
      v.literal("review"),
      v.literal("composing"),
      v.literal("done"),
      v.literal("failed"),
    ),
    step: v.string(),
    candidates: v.array(
      v.object({
        photoId: v.id("photos"),
        decision: candidateDecision,
        reason: v.string(),
        score: v.number(),
        event: v.number(),
        duplicateOf: v.optional(v.id("photos")),
        pinned: v.boolean(),
      }),
    ),
    events: v.array(
      v.object({ index: v.number(), start: v.number(), end: v.number(), label: v.string() }),
    ),
    scrapbookId: v.optional(v.id("scrapbooks")),
    error: v.optional(v.string()),
    attempts: v.number(),
  }).index("by_collectionId", ["collectionId"]),

  scrapbooks: defineTable({
    collectionId: v.id("collections"),
    jobId: v.id("generationJobs"),
    title: v.string(),
    subtitle: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    theme: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    coverPhotoId: v.optional(v.id("photos")),
    pageCount: v.number(),
    schemaVersion: v.number(),
    createdBy: v.id("users"),
    publishedAt: v.optional(v.number()),
  })
    .index("by_collectionId", ["collectionId"])
    .index("by_jobId", ["jobId"]),

  pages: defineTable({
    scrapbookId: v.id("scrapbooks"),
    order: v.number(),
    template: v.string(),
    paper: v.string(),
    elements: v.array(pageElement),
    schemaVersion: v.number(),
  }).index("by_scrapbookId_and_order", ["scrapbookId", "order"]),
});
