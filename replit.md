# LaunchPad

Founders describe their product, get a complete AI-generated ad campaign, and push it live to Meta, TikTok, and Google — without ever touching an ad platform. Ads go live after admin review.

## Run & Operate

Local mock (no Replit `DATABASE_URL`): copy `.env.example` to `.env` (names only). Then:

```bash
docker compose up -d --wait
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/launchpad run dev
```

Off Replit, unset `DATABASE_URL` uses compose `postgres://launchpad:launchpad@127.0.0.1:5432/launchpad`. Keep `ADS_MODE=mock`. `curl http://127.0.0.1:8080/api/healthz`.

- `pnpm run db:up` — same as `docker compose up -d --wait`
- `pnpm --filter @workspace/launchpad run dev` — frontend on 5173; proxies `/api` and `/p` to the API
- `pnpm --filter @workspace/api-server run dev` — API on `API_PORT` (default 8080); loads repo-root `.env`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui (Instrument Serif + Inter fonts)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (`DATABASE_URL` required to boot)
- AI copy: Anthropic Claude (`ANTHROPIC_API_KEY` or `AI_INTEGRATIONS_ANTHROPIC_*`)
- Image gen: `gemini-3-pro-image-preview` then `gpt-image-1`; fail-closed (no silent SVG). Optional fal.ai for product-photo background removal only.
- Storage: Replit Object Storage, local `/tmp/launchpad-assets` fallback; public URLs are relative `/api/assets/...`
- Payments: Stripe Checkout; webhook sets `in_review` (does **not** auto-publish)
- Ads: Meta + TikTok + Google (v1). LinkedIn unimplemented. Mock by default (`ADS_MODE=mock`). Saving connector creds never flips live. Client brands publish to per-customer ad account IDs; house env IDs are LaunchPad tests only.
- Auth: magic links via email (log-only in v1)
- Admin: `/admin` requires `ADMIN_PASSWORD` (503 without it)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/launchpad/` — React frontend
- `artifacts/api-server/src/routes/` — Express route handlers (incl. `mcp.ts` — MCP endpoint at `/api/mcp`)
- `artifacts/api-server/src/mcp/` — MCP server: registers campaign tools for AI clients
- `artifacts/api-server/src/ads/` — Ad platform clients (mock/meta/tiktok/google; linkedin stub)
- `artifacts/api-server/src/lib/` — Shared libs: Claude, auth, storage, image pipeline, `campaignService.ts` (shared by REST routes + MCP)
- `lib/db/src/schema/` — Drizzle table definitions
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas

## Architecture

1. User describes product → POST /api/campaigns/generate → Claude generates JSON → image jobs enqueued
2. Frontend polls GET /api/campaigns/:id/status until copy is ready; images finish as background jobs
3. In-process worker drains `generate_image` jobs (`gemini-3-pro-image-preview` then `gpt-image-1`, fail-closed)
4. User clicks Ship → POST /api/campaigns/:id/publish → Stripe Checkout (`status=publishing`)
5. `checkout.session.completed` → claim campaign, `in_review` + `pendingPublishJson` (does **not** auto-publish)
6. Admin assigns per-customer Meta Ad Account / TikTok advertiser / Google Customer IDs (or marks a LaunchPad house test), then approves in `/admin` → publish to those accounts (still mock unless `ADS_MODE=live`)
7. Landing pages served at `/p/:slug` (server-rendered HTML from campaign JSON)

## Product

The experience is one page that evolves through states:
1. **Input** — Describe your product (no account needed)
2. **Working** — Spinner while Claude generates the campaign
3. **Briefing** — One-pager: brand name, three ads (hero/context/tight crop), landing page iframe
4. **Revision** — Bottom sheet chat for AI-powered revisions
5. **Ship** — Daily budget, channel split (Meta/TikTok/Google), Stripe checkout
6. **Review** — After paid checkout: waiting for admin. Not live yet. Do not drop back to ship UI if the webhook is late.
7. **Live** — After admin approval. Metrics strip, pause link.

## Secrets required (NAMES only)

- `DATABASE_URL` — required on Replit; local mock falls back to docker-compose Postgres
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` + `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `GEMINI_API_KEY` / `OPENAI_API_KEY` — photoreal ads (do not call Pro Image until CEO approves spend)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — locally: `stripe listen --forward-to localhost:8080/api/webhooks/stripe`
- `ADMIN_PASSWORD` — `/admin` + encrypted connectors
- `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID` (**house/test Ad Account ID**, digits only, no `act_` prefix, not Business Manager ID), `META_DEFAULT_PAGE_ID`
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_BC_ID`, `TIKTOK_ADVERTISER_ID`, `TIKTOK_IDENTITY_ID` (CUSTOMIZED_USER identity, required for image ads) — house/test advertiser only
- `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` (house/test), `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC)
- `ADS_MODE=mock` — documented default; saving creds never flips live
- `PUBLIC_APP_URL` — local Stripe return, e.g. `http://localhost:5173`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `ADS_MODE=mock` must stay mock until platform approvals and a conscious live cutover. Saving Admin → Connectors never assigns `ADS_MODE`.
- Stripe webhooks need a raw body — `/api/webhooks/stripe` uses `express.raw()` before `express.json()`.
- If the webhook misses, status stays `publishing`. Home must still show ReviewState after paid checkout (`?success=true`).
- Landing pages are at `/p/:slug` on the Express server (Vite proxies `/p` locally).
- Silent SVG/gradient is a FAIL. UI says generation failed.
- Jobs status is `done` (not `completed`).
- Local asset URLs are relative `/api/assets/...`, never `https://localhost`.
- After any spec change: run `pnpm --filter @workspace/api-spec run codegen` before writing routes
- Local mock needs Postgres: `docker compose up -d --wait` then `pnpm --filter @workspace/db run push`. Off Replit, empty `DATABASE_URL` uses the compose URL. Do not set `ADS_MODE=live`.

## Pointers

- See `README.md` for full setup: Stripe webhook forward, Meta / TikTok / Google dashboard steps
- See `.env.example` for names that match CODE
