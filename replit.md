# LaunchPad

Founders describe their product, get a complete AI-generated ad campaign in 30 seconds, and push it live to Meta + TikTok — without ever touching an ad platform. LaunchPad acts as agency of record on their behalf.

## Run & Operate

- `pnpm --filter @workspace/launchpad run dev` — run the frontend (auto-assigned port)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui (Instrument Serif + Inter fonts)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude claude-sonnet-4-5 (campaign generation + revision)
- Image gen: fal.ai (FLUX, Ideogram, Gemini Flash) + sharp compositing + SVG fallback
- Storage: Replit Object Storage
- Payments: Stripe Checkout + metered subscriptions
- Ads: Meta Business API + TikTok Business API (mock mode by default via `ADS_MODE=mock`)
- Auth: magic links via email (no passwords)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/launchpad/` — React frontend (one-page, six-state UX)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/ads/` — Ad platform interfaces (mock/meta/tiktok)
- `artifacts/api-server/src/lib/` — Shared libs: Claude, auth, storage, image pipeline
- `lib/db/src/schema/` — Drizzle table definitions (users, campaigns, ad_assets, publishes, jobs, subscriptions, magic_links, metrics_snapshots)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas

## Architecture

1. User describes product → POST /api/campaigns/generate → Claude generates JSON → image jobs enqueued
2. Frontend polls GET /api/campaigns/:id/status every 3s until status=ready
3. Image worker (POST /api/jobs/worker) pulls pending jobs, calls fal.ai, composites with sharp, stores in Object Storage
4. User clicks Ship → POST /api/campaigns/:id/publish → Stripe Checkout
5. checkout.session.completed webhook → create user, claim campaign, publish to platforms, send magic link
6. Landing pages served at /p/:slug (server-rendered HTML from campaign JSON)

## Product

The entire experience is one page that evolves through six states:
1. **Input** — Describe your product (no account needed)
2. **Working** — Spinner while Claude generates the campaign
3. **Briefing** — Agency-quality one-pager: brand name, three ads with shimmer images, landing page iframe
4. **Revision** — Bottom sheet chat for AI-powered revisions (3 free, unlimited after shipping)
5. **Ship modal** — Daily budget preset, channel split, one Stripe checkout
6. **Live** — Metrics strip polling every 30s, pause link

## Secrets required

- `ANTHROPIC_API_KEY` — required to run at all
- `FAL_API_KEY` — image gen (SVG fallback if absent)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — payments
- `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID`, `META_DEFAULT_PAGE_ID` — Meta ads
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_BC_ID`, `TIKTOK_ADVERTISER_ID` — TikTok ads
- `ADS_MODE=mock` — env var (already set); change to `live` when platform approvals land

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `ADS_MODE=mock` must be set (already done) for the app to work before ad platform approvals
- Stripe webhooks need a raw body — `/api/webhooks/stripe` uses `express.raw()` before `express.json()`
- Landing pages are at `/p/:slug` on the Express server, not the Vite frontend
- Image composite uses sharp (server-side) — SVG fallback triggers if fal.ai is unavailable
- After any spec change: run `pnpm --filter @workspace/api-spec run codegen` before writing routes

## Pointers

- See `README.md` for full setup: Stripe products, Meta Business setup, TikTok API application, scheduled deployments
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
