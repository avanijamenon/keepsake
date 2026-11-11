/**
 * Optional vision pass with an open-source model: scores how interesting each
 * photo is and writes a short caption grounded only in what's visible.
 * Results are cached on the photo, so unchanged photos are never re-analysed.
 * No face identification. Failures fall back to the heuristic scores.
 */
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { aiConfig, type AiConfig } from "./lib/ai";

const CONCURRENCY = 3;
const TIMEOUT_MS = 60_000;

const Result = z.object({
  interest: z.coerce.number().min(0).max(1).catch(0.5),
  description: z.string().catch(""),
  caption: z.string().catch(""),
  tags: z.array(z.string()).catch([]),
});

const PROMPT = `You help assemble a personal photo scrapbook. Look at this one photo and reply with ONLY a JSON object, no other text:
{"interest": number from 0 to 1, "description": string, "caption": string, "tags": string[]}

- interest: how much the photo would add to a scrapbook of everyday memories. Candid, warm, funny or atmospheric moments can score high even if technically imperfect. Screenshots, receipts, documents, accidental shots and near-blank frames score low.
- description: one plain sentence describing what is visible.
- caption: a short, warm, lowercase scrapbook caption, at most 8 words, based only on what is visible. Never invent names, relationships, places, events or stories that are not evident in the image. Never identify people.
- tags: up to 4 single-word scene tags.`;

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Pull the first JSON object out of a reply, tolerating code fences. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON in reply");
  return JSON.parse(text.slice(start, end + 1));
}

async function analyseOne(cfg: AiConfig, thumbUrl: string) {
  const img = await fetch(thumbUrl);
  if (!img.ok) throw new Error(`thumbnail fetch failed (${img.status})`);
  const dataUrl = `data:image/jpeg;base64,${toBase64(await img.arrayBuffer())}`;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`model call failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  const r = Result.parse(extractJson(text));
  return {
    interest: Math.min(1, Math.max(0, r.interest)),
    description: r.description.slice(0, 300),
    caption: r.caption.toLowerCase().trim().replace(/[.!]+$/, "").slice(0, 80),
    tags: r.tags.slice(0, 4).map((t) => t.slice(0, 24)),
    model: cfg.model,
  };
}

export const analysePhotos = internalAction({
  args: { jobId: v.id("generationJobs"), photoIds: v.array(v.id("photos")) },
  returns: v.null(),
  handler: async (ctx, { jobId, photoIds }) => {
    const cfg = aiConfig();
    if (!cfg) {
      await ctx.runMutation(internal.generation.runCuration, { jobId });
      return null;
    }
    const pending = await ctx.runQuery(internal.photos.forAnalysis, { photoIds });
    let done = 0;
    let failures = 0;
    const queue = [...pending];

    const worker = async () => {
      while (queue.length) {
        const p = queue.shift()!;
        try {
          if (!p.thumbUrl) throw new Error("no thumbnail");
          const ai = await analyseOne(cfg, p.thumbUrl);
          await ctx.runMutation(internal.generation.saveAnalysis, {
            updates: [{ photoId: p._id as Id<"photos">, ai }],
          });
        } catch (error) {
          failures++;
          console.error("photo analysis failed", { jobId, photoId: p._id, error: String(error) });
        }
        done++;
        if (done % 3 === 0 || done === pending.length) {
          await ctx.runMutation(internal.generation.setStep, {
            jobId,
            step: `looking closely at photo ${done} of ${pending.length}`,
          });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (failures) {
      console.warn("continuing with heuristic scores for unanalysed photos", { jobId, failures });
    }
    await ctx.runMutation(internal.generation.runCuration, { jobId });
    return null;
  },
});
