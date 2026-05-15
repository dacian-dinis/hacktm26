# Deploy — Veritas Stack

Two services. Free tiers work for the demo; budget an upgrade once Tier 3
(HuggingFace model load) and the C2PA Rust deps land.

## Backend — Render (FastAPI)

Render reads `render.yaml` at the repo root.

1. Push your work to a branch on GitHub (`main` for prod, feature branch
   for previews).
2. https://dashboard.render.com → **New +** → **Blueprint** → connect this
   repository.
3. Render picks up `render.yaml` and provisions `veritas-stack-api` from
   `apps/api/`. Health check is `GET /health`.
4. Set the env vars (the blueprint declares them with `sync: false` so they
   never enter git):
   - `BING_SEARCH_API_KEY`
   - `GOOGLE_FACTCHECK_API_KEY`
   - `HF_TOKEN`
   - `CORS_ORIGINS=https://<your-vercel-domain>.vercel.app,https://<preview-pattern>.vercel.app`
5. After the first deploy, note the public URL (e.g.
   `https://veritas-stack-api.onrender.com`). Use it for
   `NEXT_PUBLIC_API_BASE` below.

**Free-tier caveat:** Render free dynos sleep after 15 min of inactivity.
First-request cold start is ~30 s. For the demo, hit the URL ~1 min before
the pitch to warm it. Once Tier 3 lands the HF model load may push memory
past the 512 MB free-tier limit — upgrade to Starter ($7/mo) if so.

## Frontend — Vercel (Next.js)

`apps/web/vercel.json` declares the Next.js framework. The repo is a
monorepo, so:

1. https://vercel.com/new → import the repo.
2. **Root Directory:** `apps/web` (Vercel will validate the Next config
   here).
3. **Environment variables:**
   - `NEXT_PUBLIC_API_BASE=https://veritas-stack-api.onrender.com`
4. Deploy. Preview URLs pattern: `https://veritas-git-<branch>-<scope>.vercel.app`
   — add that pattern to Render's `CORS_ORIGINS`.

## Browser extension

The extension defaults to `localhost:8000` / `localhost:3000`. For a
deployed demo:

1. Load unpacked from `packages/extension/` (see its README).
2. Click the puzzle-piece → Veritas Stack → **Options**.
3. Set:
   - **API base:** `https://veritas-stack-api.onrender.com`
   - **Web base:** `https://<your-vercel-domain>.vercel.app`

## Rollback / disaster recovery

- Render keeps the last good deploy; the dashboard has a one-click
  rollback.
- Vercel's preview deployments are immutable — you can promote any prior
  build to production from the project dashboard.
- If `main` breaks during the hackathon, both services can be pinned to a
  specific commit in their dashboards rather than a moving branch.
