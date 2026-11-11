import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { aiAnalysis } from "./schema";
import { atLeast, requireRole, roleOrNull } from "./lib/auth";
import { curate } from "./lib/curate";
import { buildScrapbook, SCHEMA_VERSION, seedFrom } from "./lib/layout";
import { urlFor } from "./lib/storage";
import { aiEnabled } from "./lib/ai";

const MAX_PHOTOS = 400;
const ACTIVE = new Set(["curating", "analysing", "review", "composing"]);

/**
 * Starts (or resumes) a generation job for a period. Idempotent: an active
 * job for the same collection + period is returned instead of duplicated.
 */
export const start = mutation({
  args: {
    collectionId: v.id("collections"),
    periodStart: v.number(),
    periodEnd: v.number(),
    label: v.string(),
    tzOffsetMinutes: v.number(),
  },
  returns: v.id("generationJobs"),
  handler: async (ctx, args) => {
    const { user } = await requireRole(ctx, args.collectionId, "contributor");
    if (args.periodEnd <= args.periodStart) throw new ConvexError("That date range is empty.");
    const recent = await ctx.db
      .query("generationJobs")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", args.collectionId))
      .order("desc")
      .take(10);
    const existing = recent.find(
      (j) =>
        ACTIVE.has(j.status) &&
        j.periodStart === args.periodStart &&
        j.periodEnd === args.periodEnd,
    );
    if (existing) return existing._id;

    const jobId = await ctx.db.insert("generationJobs", {
      collectionId: args.collectionId,
      requestedBy: user._id,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      label: args.label.slice(0, 60),
      tzOffsetMinutes: args.tzOffsetMinutes,
      status: "curating",
      step: "gathering photos",
      candidates: [],
      events: [],
      attempts: 1,
    });
    await kickoff(ctx, jobId);
    return jobId;
  },
});

async function kickoff(ctx: MutationCtx, jobId: Id<"generationJobs">) {
  const job = (await ctx.db.get("generationJobs", jobId))!;
  await ctx.db.patch("generationJobs", jobId, { step: "gathering photos" });
  const photos = await photosInPeriod(ctx, job);
  if (aiEnabled() && photos.some((p) => !p.ai)) {
    await ctx.db.patch("generationJobs", jobId, { status: "analysing" });
    await ctx.scheduler.runAfter(0, internal.ai.analysePhotos, {
      jobId,
      photoIds: photos.filter((p) => !p.ai).map((p) => p._id),
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.generation.runCuration, { jobId });
  }
}

async function photosInPeriod(ctx: MutationCtx, job: Doc<"generationJobs">) {
  return await ctx.db
    .query("photos")
    .withIndex("by_collectionId_and_takenAt", (q) =>
      q
        .eq("collectionId", job.collectionId)
        .gte("takenAt", job.periodStart)
        .lt("takenAt", job.periodEnd),
    )
    .take(MAX_PHOTOS);
}

function tzOf(job: Doc<"generationJobs">) {
  return job.tzOffsetMinutes;
}

export const setStep = internalMutation({
  args: { jobId: v.id("generationJobs"), step: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, step }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) return null;
    await ctx.db.patch("generationJobs", jobId, { step });
    return null;
  },
});

export const saveAnalysis = internalMutation({
  args: { updates: v.array(v.object({ photoId: v.id("photos"), ai: aiAnalysis })) },
  returns: v.null(),
  handler: async (ctx, { updates }) => {
    for (const u of updates) {
      const p = await ctx.db.get("photos", u.photoId);
      if (p) await ctx.db.patch("photos", u.photoId, { ai: u.ai });
    }
    return null;
  },
});

export const runCuration = internalMutation({
  args: { jobId: v.id("generationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job || !(job.status === "curating" || job.status === "analysing")) return null;
    const photos = await photosInPeriod(ctx, job);
    if (photos.length === 0) {
      await ctx.db.patch("generationJobs", jobId, {
        status: "failed",
        error: "There aren't any photos from this period yet.",
      });
      return null;
    }
    const pinned = new Set(job.candidates.filter((c) => c.pinned).map((c) => c.photoId as string));
    const result = curate(
      photos.map((p) => ({
        id: p._id,
        takenAt: p.takenAt,
        favourite: p.favourite,
        sha256: p.sha256,
        analysis: p.analysis,
        ai: p.ai ? { interest: p.ai.interest, description: p.ai.description } : undefined,
      })),
      { tzOffsetMinutes: tzOf(job), pinned },
    );
    await ctx.db.patch("generationJobs", jobId, {
      status: "review",
      step: "ready for review",
      events: result.events,
      candidates: result.candidates.map((c) => ({
        ...c,
        photoId: c.photoId as Id<"photos">,
        duplicateOf: c.duplicateOf as Id<"photos"> | undefined,
      })),
      error: undefined,
    });
    return null;
  },
});

export const get = query({
  args: { jobId: v.id("generationJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) return null;
    const access = await roleOrNull(ctx, job.collectionId);
    if (!access || !atLeast(access.member.role, "contributor")) return null;
    const photos = await Promise.all(
      job.candidates.map(async (c) => {
        const p = await ctx.db.get("photos", c.photoId);
        return p
          ? {
              ...c,
              thumbUrl: await urlFor(ctx, p.storage, "thumb"),
              width: p.width,
              height: p.height,
              takenAt: p.takenAt,
              favourite: p.favourite,
              caption: p.ai?.caption,
            }
          : null;
      }),
    );
    return {
      _id: job._id,
      collectionId: job.collectionId,
      label: job.label,
      status: job.status,
      step: job.step,
      error: job.error,
      events: job.events,
      scrapbookId: job.scrapbookId,
      candidates: photos.filter((p) => p !== null),
    };
  },
});

export const latestForCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const access = await roleOrNull(ctx, collectionId);
    if (!access || !atLeast(access.member.role, "contributor")) return null;
    const job = await ctx.db
      .query("generationJobs")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", collectionId))
      .order("desc")
      .first();
    if (!job || job.status === "done") return null;
    return { _id: job._id, status: job.status, label: job.label, error: job.error };
  },
});

/** Override the AI: include, exclude or pin a photo during review. */
export const setDecision = mutation({
  args: {
    jobId: v.id("generationJobs"),
    photoId: v.id("photos"),
    include: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, photoId, include }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) throw new ConvexError("That job no longer exists.");
    await requireRole(ctx, job.collectionId, "contributor");
    if (job.status !== "review") throw new ConvexError("This selection is already being made into pages.");
    await ctx.db.patch("generationJobs", jobId, {
      candidates: job.candidates.map((c) =>
        c.photoId === photoId
          ? {
              ...c,
              decision: include ? "selected" : "not_chosen",
              pinned: include,
              reason: include ? "you put this one back in" : "you set this aside",
            }
          : c,
      ),
    });
    return null;
  },
});

export const retry = mutation({
  args: { jobId: v.id("generationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) return null;
    await requireRole(ctx, job.collectionId, "contributor");
    if (job.status !== "failed") return null;
    await ctx.db.patch("generationJobs", jobId, {
      status: job.scrapbookId ? "done" : "curating",
      attempts: job.attempts + 1,
      error: undefined,
    });
    if (!job.scrapbookId) await kickoff(ctx, jobId);
    return null;
  },
});

export const dismiss = mutation({
  args: { jobId: v.id("generationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) return null;
    await requireRole(ctx, job.collectionId, "contributor");
    if (job.status === "review" || job.status === "failed") {
      await ctx.db.delete("generationJobs", jobId);
    }
    return null;
  },
});

/** Approve the selection and lay out the pages. */
export const compose = mutation({
  args: { jobId: v.id("generationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job) throw new ConvexError("That job no longer exists.");
    await requireRole(ctx, job.collectionId, "contributor");
    if (job.status !== "review") return null;
    if (!job.candidates.some((c) => c.decision === "selected")) {
      throw new ConvexError("Pick at least one photo first.");
    }
    await ctx.db.patch("generationJobs", jobId, {
      status: "composing",
      step: "arranging pages",
    });
    await ctx.scheduler.runAfter(0, internal.generation.buildPages, { jobId });
    return null;
  },
});

export const buildPages = internalMutation({
  args: { jobId: v.id("generationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job || job.status !== "composing") return null;
    // Idempotency: a retried run never makes a second scrapbook.
    const already = await ctx.db
      .query("scrapbooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .first();
    if (already) {
      await ctx.db.patch("generationJobs", jobId, { status: "done", scrapbookId: already._id });
      return null;
    }
    try {
      const collection = (await ctx.db.get("collections", job.collectionId))!;
      const tz = tzOf(job);
      const selected = job.candidates.filter((c) => c.decision === "selected");
      const photos = await Promise.all(selected.map((c) => ctx.db.get("photos", c.photoId)));
      const contributorIds = [...new Set(photos.filter((p) => p).map((p) => p!.contributorId))];
      const contributors = await Promise.all(contributorIds.map((id) => ctx.db.get("users", id)));

      const events = job.events
        .map((e) => ({
          label: e.label,
          photos: selected
            .map((c, i) => ({ c, p: photos[i] }))
            .filter(({ c, p }) => p && c.event === e.index)
            .map(({ c, p }) => ({
              id: p!._id as string,
              takenAt: p!.takenAt,
              score: c.score,
              width: p!.width,
              height: p!.height,
              caption: p!.ai?.caption,
            })),
        }))
        .filter((e) => e.photos.length);

      const { pages, coverPhotoId } = buildScrapbook({
        seed: seedFrom(jobId),
        theme: collection.theme,
        title: collection.name.toLowerCase(),
        kicker: job.label,
        periodLabel: periodLabel(job.periodStart, job.periodEnd, tz),
        contributors: contributors.filter((u) => u).map((u) => u!.name),
        events,
        tzOffsetMinutes: tz,
      });

      const scrapbookId = await ctx.db.insert("scrapbooks", {
        collectionId: job.collectionId,
        jobId,
        title: collection.name.toLowerCase(),
        subtitle: job.label,
        periodStart: job.periodStart,
        periodEnd: job.periodEnd,
        theme: collection.theme,
        status: "draft",
        coverPhotoId: (coverPhotoId as Id<"photos"> | null) ?? undefined,
        pageCount: pages.length,
        schemaVersion: SCHEMA_VERSION,
        createdBy: job.requestedBy,
      });
      for (const [i, page] of pages.entries()) {
        await ctx.db.insert("pages", {
          scrapbookId,
          order: i,
          template: page.template,
          paper: page.paper,
          elements: page.elements.map((el) =>
            el.kind === "photo" ? { ...el, photoId: el.photoId as Id<"photos"> | null } : el,
          ),
          schemaVersion: SCHEMA_VERSION,
        });
      }
      await ctx.db.patch("generationJobs", jobId, { status: "done", scrapbookId });
    } catch (error) {
      console.error("page layout failed", { jobId, error: String(error) });
      await ctx.db.patch("generationJobs", jobId, {
        status: "failed",
        error: "Something went wrong arranging the pages. Try again?",
      });
    }
    return null;
  },
});

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function periodLabel(start: number, end: number, tz: number) {
  const s = new Date(start - tz * 60000);
  const e = new Date(end - 1 - tz * 60000);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  }
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()].slice(0, 3)} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()].slice(0, 3)} ${e.getUTCFullYear()}`;
}
