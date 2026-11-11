import { defineApp } from "convex/server";
import { v } from "convex/values";
import r2 from "@convex-dev/r2/convex.config.js";

const app = defineApp({
  env: {
    // ── Auth ────────────────────────────────────────────────────────────
    // Clerk Frontend API URL (e.g. https://your-app.clerk.accounts.dev).
    // When set, every request needs a signed-in Clerk user.
    CLERK_JWT_ISSUER_DOMAIN: v.optional(v.string()),
    // Local development only: treat unauthenticated requests as one "dev"
    // user. Ignored whenever CLERK_JWT_ISSUER_DOMAIN is set.
    DEV_AUTH_BYPASS: v.optional(v.string()),

    // ── Photo storage (Cloudflare R2) ───────────────────────────────────
    // When all four are set, photos go to R2 with signed, expiring URLs.
    // Otherwise they fall back to Convex file storage (handy locally).
    R2_BUCKET: v.optional(v.string()),
    R2_ENDPOINT: v.optional(v.string()),
    R2_ACCESS_KEY_ID: v.optional(v.string()),
    R2_SECRET_ACCESS_KEY: v.optional(v.string()),
    R2_TOKEN: v.optional(v.string()),
    // Safety caps that keep R2 inside Cloudflare's free tier (10 GB stored,
    // 1M writes/month). Uploads are refused before either is reached.
    R2_MAX_GB: v.optional(v.string()),
    R2_MAX_WRITES_PER_MONTH: v.optional(v.string()),

    // ── AI (any OpenAI-compatible endpoint serving an open vision model) ─
    // Default: Cloudflare Workers AI (free daily allowance) — set these two.
    CLOUDFLARE_ACCOUNT_ID: v.optional(v.string()),
    CLOUDFLARE_AI_TOKEN: v.optional(v.string()),
    // Or point at any other OpenAI-compatible server, e.g. a local Ollama:
    // AI_BASE_URL=http://localhost:11434/v1  AI_MODEL=gemma3:4b
    AI_BASE_URL: v.optional(v.string()),
    AI_API_KEY: v.optional(v.string()),
    AI_MODEL: v.optional(v.string()),
  },
});

app.use(r2);

export default app;
