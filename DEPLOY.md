# Putting keepsake online for free

Every piece runs on a free tier:

| Piece | Service | Free tier (check each site for current limits) |
| --- | --- | --- |
| Website | **Vercel** Hobby | Free for personal, non-commercial projects |
| Database + backend | **Convex** Free | Hosted cloud deployment |
| Sign-up / sign-in | **Clerk** Free | Generous monthly active users |
| Photo storage | **Cloudflare R2** | 10 GB stored, no egress fees |
| AI (open model) | **Cloudflare Workers AI** | 10,000 neurons/day (~a few hundred photos/day) |

You need accounts on Vercel, Convex, Clerk and Cloudflare, plus this project
in a GitHub repo. Allow about 30 minutes. Steps marked 🖥 run in a terminal
inside `keepsake/`.

---

## 1. Convex (backend)

1. 🖥 `npx convex login` — opens the browser to sign in.
2. 🖥 `npx convex dev --configure=new` — creates a cloud **dev** project and
   rewrites `.env.local` to point at it (replacing the local anonymous one).
3. In the Convex dashboard: **Settings → Deploy keys → Generate production
   deploy key**. Keep it for step 5.

Every `npx convex env set …` below targets your dev deployment. Repeat each one
with `--prod` for production.

## 2. Clerk (sign-up)

1. Create an application at clerk.com. Pick the sign-in options (email,
   Google, …).
2. **Integrations → Convex → Activate.** Copy the **Frontend API URL** it shows.
3. 🖥 `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev`
4. 🖥 `npx convex env remove DEV_AUTH_BYPASS` (only matters if you ran the local setup).
5. **API keys** page: put the publishable and secret keys in `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
6. **Paths:** set sign-in to `/sign-in` and sign-up to `/sign-up` (the app has
   its own styled pages there).

When you go live, Clerk asks you to create a **production instance** on your
own domain. It has its own keys and Frontend API URL; use those for `--prod`
and on Vercel.

## 3. Cloudflare R2 (photos)

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `keepsake-photos`).
2. Bucket → **Settings → CORS policy** (browsers upload straight to R2):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://<your-app>.vercel.app"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["Content-Type"]
     }
   ]
   ```
3. R2 → **Manage API tokens → Create API token**: Object Read & Write, limited
   to that bucket. It shows four values:
   ```bash
   npx convex env set R2_BUCKET keepsake-photos
   npx convex env set R2_ENDPOINT https://<account-id>.r2.cloudflarestorage.com
   npx convex env set R2_ACCESS_KEY_ID ...
   npx convex env set R2_SECRET_ACCESS_KEY ...
   npx convex env set R2_TOKEN ...
   ```

The bucket stays private. The app hands out signed links that expire after
6 hours.

**Staying inside the free tier:** Cloudflare has no hard spending cap for R2,
so the app enforces one. It refuses uploads before stored photos reach **9 GB**
(the free tier is 10 GB) or uploads reach **900k writes in a month** (the free
tier is 1M). Deleting photos frees the space again. To change the caps:
`npx convex env set R2_MAX_GB 5` or `npx convex env set R2_MAX_WRITES_PER_MONTH 500000`.
Viewing photos counts as reads (10M free per month), which the app can't cap.
Add a backstop in Cloudflare: **Notifications → Add → Usage Based Billing**,
which emails you if any paid usage starts.

## 4. Workers AI (free open-source model)

1. Note your **Account ID** (Cloudflare dashboard sidebar).
2. **My Profile → API Tokens → Create token**, using the "Workers AI" template.
3. 🖥
   ```bash
   npx convex env set CLOUDFLARE_ACCOUNT_ID <account-id>
   npx convex env set CLOUDFLARE_AI_TOKEN <token>
   ```

The default model is **Mistral Small 3.1 24B** (Apache-2.0, vision-capable).
To try another model: `npx convex env set AI_MODEL @cf/meta/llama-4-scout-17b-16e-instruct`.

**Fully local and free alternative:** run [Ollama](https://ollama.com) with a
vision model (`ollama pull gemma3:4b`), then
`npx convex env set AI_BASE_URL http://localhost:11434/v1` and
`npx convex env set AI_MODEL gemma3:4b`. This only works while Convex runs
locally, because the cloud can't reach your laptop.

With no AI settings, the app still curates using image measurements alone.

## 5. Vercel (website)

1. Push the project to GitHub, then **Add New → Project** on Vercel and import it.
   If the repo root isn't `keepsake/`, set **Root Directory** to `keepsake`.
2. Environment variables (Production):
   - `CONVEX_DEPLOY_KEY`: the production deploy key from step 1
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: production Clerk keys
3. Deploy. `vercel.json` runs `npx convex deploy --cmd 'npm run build'`, which
   pushes the backend and builds the site with the right `NEXT_PUBLIC_CONVEX_URL`.
4. Add the Vercel URL to the R2 CORS policy (step 3.2) and to Clerk's allowed
   origins and redirect URLs.

## Checklist for production (`--prod`)

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://clerk.<your-domain>
npx convex env set --prod R2_BUCKET ...            # and the other R2_* values
npx convex env set --prod CLOUDFLARE_ACCOUNT_ID ...
npx convex env set --prod CLOUDFLARE_AI_TOKEN ...
```

Never set `DEV_AUTH_BYPASS` on production. It is also ignored whenever
`CLERK_JWT_ISSUER_DOMAIN` is set.
