# keepsake

A cosy little corner of the internet for collecting moments with people you love.
Drop photos into a shared **memory box**; keepsake picks the good bits and pastes
them into an editable, collaborative scrapbook.

## Running it locally

```bash
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev   # local Convex backend on :3210 (keep running)
npm run dev                                  # Next.js on :3000
```

With no Clerk keys, the local Convex deployment runs in **dev auth mode**: every
request is treated as one local user. This is controlled by two Convex env vars
on the local deployment (already set):

```bash
npx convex env set DEV_AUTH_BYPASS true
npx convex env set CLERK_JWT_ISSUER_DOMAIN ""
```

### Going online (Clerk sign-up, R2 photos, free open-source AI, free hosting)

See **[DEPLOY.md](DEPLOY.md)**. Each piece switches on when its settings are present:

| Setting | Without it (local default) | With it |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + Convex `CLERK_JWT_ISSUER_DOMAIN` | single dev user | real sign-up / sign-in at `/sign-up`, `/sign-in` |
| Convex `R2_*` | Convex file storage | private R2 bucket, signed 6-hour URLs |
| Convex `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_TOKEN` (or `AI_BASE_URL`) | heuristic curation only | open vision model scores photos and writes grounded captions |

The AI uses any OpenAI-compatible chat endpoint. The default is Mistral Small 3.1
(Apache-2.0) on Cloudflare Workers AI's free tier; a local Ollama works too.
It never identifies faces or invents stories, and results are cached per photo.

## How it fits together

| Area | Where |
| --- | --- |
| Schema (users, collections, members, invites, photos, jobs, scrapbooks, pages) | `convex/schema.ts` |
| Permissions (owner / contributor / viewer, enforced server-side) | `convex/lib/auth.ts` |
| Ingestion: browser preprocessing → upload → record | `src/lib/preprocess.ts`, `src/lib/useUploader.ts`, `convex/photos.ts` |
| Curation: duplicates, quality floor, events, balanced selection | `convex/lib/curate.ts` |
| Optional open-model vision pass | `convex/ai.ts`, `convex/lib/ai.ts` |
| Photo storage (R2 / Convex fallback) | `convex/lib/storage.ts` |
| Generation jobs (idempotent, retryable, review step) | `convex/generation.ts` |
| Layout engine → structured page spec (no flattened images) | `convex/lib/layout.ts` |
| Templates & themes (shared by engine and renderer) | `convex/shared/` |
| Renderer (reader, editor, future export) | `src/components/scrapbook/PageView.tsx` |
| Narrow page-edit mutations | `convex/pages.ts` |
| Design system | `src/components/ui`, `src/components/art`, `src/app/globals.css` |

## Not built yet

- **Server-side Sharp:** preprocessing runs in the browser today, producing the
  same output a worker would.
- Scheduled weekly/monthly generation (frequency is stored; no cron yet),
  notifications, PDF/image export, Google Photos Picker, iOS companion.
