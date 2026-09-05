# LaunchPad

Founders describe their product, get a complete AI-generated ad campaign in 30 seconds, and push it live to Meta, TikTok, and Google — without ever touching an ad platform.

The product URL is the Vite app in `artifacts/launchpad`. Generate and revise run on the Express API in `artifacts/api-server`. Production host is **Vercel** (one deployment: site + `/api`). Replit is not required.

---

## Setup

### Host on Vercel (production)

`vercel.json` defines two services in one project: **frontend** (`artifacts/launchpad`, Vite) and **api** (`artifacts/api-server`, Express). Top-level rewrites send `/api/*` and `/p/*` to the API and everything else to the site. Generate/revise are not a static-only deploy. Both services run `installCommand` from the **repo root** (`cd ../.. && pnpm install --frozen-lockfile`) so they use the root `pnpm-lock.yaml` / `pnpm-workspace.yaml` and can resolve `workspace:*` packages. There is no second lockfile inside a package.

1. Import this GitHub repo in Vercel. **Root Directory** = repository root (`.`). **Framework Preset** = **Services**.
2. Set environment variables (names only — never commit values). Attach them to the **api** service (not only the frontend) and to Production, Preview, and Development as needed. Redeploy Production after adding them so the function actually receives the new names:

| Name | Required | Notes |
|------|----------|--------|
| `DATABASE_URL` | **Yes** | Neon/Vercel Postgres **pooled** URL (`sslmode=require`). No docker-compose in production. |
| `ADS_MODE` | **Yes** | `mock` — no live ad spend |
| `AI_GATEWAY_API_KEY` | Preferred for copy | Vercel AI Gateway. On Vercel, OIDC (`VERCEL_OIDC_TOKEN`) is injected — enable Secure backend access with OIDC + AI Gateway so Grok (`xai/grok-4.6`) works without a pasted xAI console key. |
| `XAI_API_KEY` | Fallback for copy | Only if Gateway is unavailable. Set in Vercel env; never commit. |
| `PUBLIC_APP_URL` | Recommended | Production origin, e.g. `https://your-domain.vercel.app` (Stripe return + landing URLs) |
| `ADMIN_PASSWORD` | For `/admin` | Operator password. Without it, `/admin` shows “not configured” and `/api/admin/*` returns 503. Set on the **api** service, then **redeploy**. |
| `BLOB_READ_WRITE_TOKEN` | **Yes** (production images) | Vercel Blob. Required on Vercel so generated ads persist across invocations — `/tmp` does not. Names only here; set the value in Vercel env. |
| `CRON_SECRET` / `WORKER_SECRET` | Optional | Vercel Cron sends `Authorization: Bearer CRON_SECRET` to `/api/jobs/worker` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | Webhook: `https://<deployment>/api/webhooks/stripe` |
| Image / ad-platform names | Optional until live | Same names as `.env.example` |

3. Provision Postgres: Vercel Marketplace Neon (`vercel integration add neon`) or paste a Neon pooled `DATABASE_URL`.
4. **Schema push** (not part of the Vercel build). From a machine with the production URL:

```bash
# after `vercel env pull .env.local --yes` or exporting DATABASE_URL
pnpm --filter @workspace/db run push
```

5. Deploy (`git push` with Vercel Git integration, or `vercel --prod`). Confirm:

```bash
curl -s https://<deployment>/api/healthz   # {"status":"ok"}
```

Then open the deployment URL and run generate/revise — `/api` is the same origin.

`vercel.json` also registers a daily cron for `/api/jobs/worker` (image queue backup). Generate returns copy first, then drains stills via `waitUntil` plus `POST /api/campaigns/:id/render-stills`. Add `/api/jobs/spend-guard` as another cron if you want hourly spend snapshots (Pro plans allow more frequent schedules).

### Boot locally (`ADS_MODE=mock`)

Postgres is required for `db push` and the API. House ad accounts stay test-only; this path does not flip live or spend. docker-compose is **local only**.

```bash
pnpm install
cp .env.example .env          # names only — fill keys you have; leave the rest blank
docker compose up -d --wait   # local Postgres at 127.0.0.1:5432 (user/db: launchpad)
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev    # API, default 8080
pnpm --filter @workspace/launchpad run dev     # frontend, 5173, proxies /api
```

If `DATABASE_URL` is unset **and** you are not on Vercel/Replit, drizzle and the API use `postgres://launchpad:launchpad@127.0.0.1:5432/launchpad`. On Vercel, `DATABASE_URL` is required. Keep `ADS_MODE=mock`.

Confirm the API: `curl -s http://127.0.0.1:8080/api/healthz` → `{"status":"ok"}`.

Prefer Gateway locally too: `vercel link` then `vercel env pull .env.local --yes` (OIDC token, ~24h). Or set `AI_GATEWAY_API_KEY`. Fallback: `XAI_API_KEY`.

### Environment variables

Copy `.env.example` to `.env` in the repo root. Names only — no values in the example except `ADS_MODE=mock`. The API loads `.env` on boot if present (existing env / Vercel env win). Vite reads the same file (`envDir` = repo root).

```
ADS_MODE=mock
```

`ADMIN_PASSWORD` is required for `/admin` and `/login`. Without it, the desk shows “not configured” and `/api/admin/*` returns 503.

### Operator checklist (Michael — admin + connectors)

Production admin is blocked only by a missing env, not by missing code. After this is set, `/admin` is a password login and Connectors accepts pasted secrets.

1. Vercel → Project → Settings → Environment Variables.
2. Add `ADMIN_PASSWORD` (strong). Attach to the **api** service, Production + Preview (and Development if you use `vercel dev`).
3. Leave `ADS_MODE=mock`. Do not set live. Saving connectors never flips this.
4. Redeploy Production (existing functions do not pick up a new name until redeploy).
5. Open `https://<deployment>/admin` (same form at `/login` and `/admin/connectors`).
6. Enter that password. Open **Connectors**. Paste house Meta / TikTok / Google values. The UI shows key **names** only; status is Connected or Not connected. Values are encrypted at rest with a key derived from `ADMIN_PASSWORD`.
7. Optional: the same names can live in Vercel env instead of the form. Status still reflects connected/missing.

House connector names (paste in Connectors or set in Vercel env — never commit values):

| Platform | Required names | Optional |
|----------|----------------|----------|
| Meta | `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID` (house/test **Ad Account ID**, digits only, no `act_`), `META_DEFAULT_PAGE_ID` | — |
| TikTok | `TIKTOK_ACCESS_TOKEN`, `TIKTOK_BC_ID`, `TIKTOK_ADVERTISER_ID`, `TIKTOK_IDENTITY_ID` (CUSTOMIZED_USER) | — |
| Google | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC) |

Rotating `ADMIN_PASSWORD` invalidates stored (encrypted) credentials; they must be pasted again. Env-var secrets are unaffected.

Client brands do **not** publish through these house IDs. After a founder ships, set per-customer Ad Account / advertiser / Customer IDs under Admin → Clients. Isolate-per-customer stays law.

Local Stripe return uses `PUBLIC_APP_URL` if set, otherwise Vite (`http://127.0.0.1:5173`). If the webhook has not flipped status yet, Home still shows ReviewState (not the ship UI) while status is `publishing`.

Local asset URLs are relative `/api/assets/...` (browser + Vite proxy). Do not expect `https://localhost`.

Optional names (same as `.env.example`): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `FAL_API_KEY`, Meta / TikTok / Google house IDs, `XAI_BASE_URL`, `XAI_MODEL` (defaults `grok-4.6`; Gateway uses `xai/grok-4.6`).

---

## Mock Mode vs Live Mode

`ADS_MODE=mock` (the default) makes publishing work end-to-end without spending:
- Campaign copy: Grok writes generate + revise from the founder prompt when AI Gateway (or `XAI_API_KEY`) is configured. No Anthropic key required.
- Image generation uses Grok Imagine (`xai/grok-imagine-image`) then `gpt-image-2`. If both miss or fail Craft lock, the job **fails** — a branded gradient is not an ad. Never Gemini.
- Publishing logs realistic fake API request bodies and returns deterministic mock IDs/metrics
- Stripe checkout works with `STRIPE_SECRET_KEY`

**To go live**: set `ADS_MODE=live` once Meta, TikTok, and Google credentials are saved **and** each client has On Behalf Of / partner / MCC access granted. Saving credentials in Admin → Connectors does **not** flip live.

---

## Per-customer ad accounts

Client brands never publish through LaunchPad house IDs — even for the first five customers. Store one Meta Ad Account ID, TikTok advertiser ID, and Google Ads Customer ID per client in Admin → Client ad accounts (or on the campaign card). At publish time those IDs overlay the house credential *tokens*:

- **Meta:** LaunchPad system-user token + client's Ad Account ID and Page ID (Business On Behalf Of). `META_BUSINESS_ID` in env is the house/test Ad Account only.
- **TikTok:** LaunchPad partner access token + client's advertiser and **CUSTOMIZED_USER** identity. House `TIKTOK_ADVERTISER_ID` is tests only.
- **Google:** MCC is `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (house). Client Customer ID overlays `GOOGLE_ADS_CUSTOMER_ID`.

Humans still have to complete, as named steps (not tokens): Request Business On Behalf Of access; Client BM admin accepts the On Behalf Of request; Send TikTok partner access request; Client accepts partner access; Send MCC manager invitation; Client accepts the manager invitation.

A campaign marked **house test** (or a user flagged as LaunchPad house) may use house env IDs. Client campaigns missing IDs fail closed and do not fall back to house.

---

## Stripe Setup

### Products and prices

In the Stripe Dashboard → Products, create:

1. **LaunchPad Platform** — $29/mo base subscription
   - Product name: `LaunchPad Platform`
   - Price: $29.00 / month (recurring)
   - Note the Price ID (`price_xxx`)

2. **Ad Spend Fee (metered)** — 10% of ad budget, reported nightly
   - Product name: `Ad Spend Service Fee`
   - Price: usage-based / metered, per unit = $0.001 (reconciled nightly)

3. **LaunchPad Pro** — $99/mo (upsell only, never shown in ship flow)
   - Product name: `LaunchPad Pro`
   - Price: $99.00 / month (recurring)

### Webhook

Checkout does **not** publish ads. `checkout.session.completed` claims the campaign, stores `pendingPublishJson`, and sets status `in_review`. An admin approves in `/admin` before anything is sent to Meta/TikTok/Google.

Locally, Stripe cannot reach your machine unless you forward events:

```bash
stripe listen --forward-to localhost:8080/api/webhooks/stripe
```

Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`. Without this, status stays `publishing` after pay.

Deployed endpoint: `https://your-domain/api/webhooks/stripe` listening to:
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

---

## Meta Ads Setup (1–3 weeks for approvals)

**Start this today — it's your critical path.**

### Step 1: Meta Business Verification
1. Go to [business.facebook.com](https://business.facebook.com) → Settings → Business Info
2. Start the business verification flow — submit legal business name, address, and tax ID / business registration
3. Verification typically takes 1–5 business days

### Step 2: Create a System User
1. Business Settings → System Users → Add
2. Name: "LaunchPad Agency"
3. Role: Admin
4. Click "Generate Token" → check `ads_management`, `business_management`, `pages_read_engagement`
5. Save the token as `META_SYSTEM_USER_TOKEN`

### Step 3: Request Marketing API Advanced Access
1. Business Settings → App → your app → Permissions
2. Request `ads_management` → Advanced Access
3. Submit use case: "Agency running ads on behalf of clients through a system user under our Business Manager"
4. Approval: typically 1–2 weeks; you can create and pause campaigns in Standard Access while waiting

### Step 4: Get IDs
- `META_BUSINESS_ID`: Business Settings → Accounts → Ad Accounts → copy LaunchPad's **house/test Ad Account ID** (digits only, no `act_` prefix). Paste it as `META_BUSINESS_ID` — that field is the Ad Account ID, not the Business Manager ID. Client brands get their own Ad Account IDs under Admin → Client ad accounts.
- `META_DEFAULT_PAGE_ID`: Your Facebook Page → About → Page ID

---

## TikTok Ads Setup (1–3 weeks for approvals)

**Start this today — also on your critical path.**

### Step 1: TikTok Business Center
1. Go to [business.tiktok.com](https://business.tiktok.com) → Create Business Center
2. Complete business verification

### Step 2: Apply for Marketing API
1. [developers.tiktok.com](https://developers.tiktok.com) → Create App
2. Add product: "Marketing API"
3. Request scopes: `campaign/create`, `adgroup/create`, `ad/create`, `report/integrated/get`
4. Submit for review — approval typically 1–3 weeks

### Step 3: Get credentials
- `TIKTOK_ACCESS_TOKEN`: TikTok Ads Manager → Tools → Open API → Generate Access Token
- `TIKTOK_BC_ID`: Business Center Settings → Business Center ID
- `TIKTOK_ADVERTISER_ID`: TikTok Ads Manager advertiser ID
- `TIKTOK_IDENTITY_ID`: Business Center → a verified **CUSTOMIZED_USER** identity ID (required for image ads; already in Admin → Connectors)

---

## Google Ads Setup

v1 channel. Saving these in Admin → Connectors does **not** turn on live spend (`ADS_MODE` stays `mock` until you set it).

1. Google Ads Manager → API Center → developer token → `GOOGLE_ADS_DEVELOPER_TOKEN` ([API Center](https://ads.google.com/aw/apicenter))
2. Google Cloud Console → APIs & Services → Credentials → OAuth client → `GOOGLE_ADS_CLIENT_ID` and `GOOGLE_ADS_CLIENT_SECRET` ([Credentials](https://console.cloud.google.com/apis/credentials))
3. OAuth Playground with the AdWords scope → `GOOGLE_ADS_REFRESH_TOKEN` ([Playground](https://developers.google.com/oauthplayground))
4. Ads account Customer ID (digits; dashes stripped) → `GOOGLE_ADS_CUSTOMER_ID`
5. Only if you publish through a manager account: `GOOGLE_ADS_LOGIN_CUSTOMER_ID`

---

After deploying, Vercel Cron (see `vercel.json`) hits:

| Name | URL | Schedule | Purpose |
|------|-----|----------|---------|
| Image Worker | `GET /api/jobs/worker` | Daily | Drain image generation queue (backup) |
| Spend Guard | `GET /api/jobs/spend-guard` | Optional extra cron | Snapshot metrics / pause at cap |

Generate also drains pending image jobs in the same invocation. Add `CRON_SECRET` (Vercel Cron `Authorization: Bearer`) or `WORKER_SECRET` (`X-Worker-Secret`) to lock the worker.

---

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui — one page, six states (`artifacts/launchpad`)
- **Backend**: Express 5 + Node.js 22+ + TypeScript (`artifacts/api-server`)
- **Host**: Vercel Services — one project, rewrites `/api` and `/p` to Express
- **Database**: PostgreSQL + Drizzle ORM (`DATABASE_URL`, Neon-compatible)
- **AI copy**: Grok via Vercel AI Gateway (`xai/grok-4.6`) or `XAI_API_KEY` fallback. Writes generate + revise from the founder prompt.
- **Image gen**: Grok Imagine (`xai/grok-imagine-image`) then `gpt-image-2`. Fail-closed Craft lock — a branded gradient is not an ad. Type is composited in designed negative space after the mute plate passes. Never Gemini.
- **Storage**: Vercel Blob on Vercel (`BLOB_READ_WRITE_TOKEN` required — fail-closed, no `/tmp`). Off Vercel: Replit Object Storage fallback, then local `/tmp/launchpad-assets`. Public URLs are relative `/api/assets/...`
- **Payments**: Stripe Checkout + subscriptions + metered usage
- **Ads**: Meta + TikTok + Google (mock mode by default; LinkedIn is out of v1)
- **Auth**: Magic links via email (no passwords ever)

### Data flow
1. User describes the product → `POST /api/campaigns/generate` → Grok writes campaign JSON from that prompt → 201 with copy ready; image jobs drain in the background
2. Frontend shows agency steps, then the briefing (three ads + landing) as soon as copy is ready; images finish as background jobs (Grok Imagine then `gpt-image-2`, fail-closed)
3. In-process worker drains `generate_image` jobs (status polls and `POST /api/campaigns/:id/render-stills` keep stills alive on Vercel; optional cron: `POST /api/jobs/worker`)
4. User clicks Ship → `POST /api/campaigns/:id/publish` → Stripe Checkout (`status=publishing`)
5. `checkout.session.completed` webhook → claim campaign, set `in_review` + `pendingPublishJson` (does **not** auto-publish)
6. Admin stores per-customer ad account IDs (or marks a house test) then approves in `/admin` → publish to those accounts (still mock unless `ADS_MODE=live`)
7. Frontend shows ReviewState after paid checkout; LiveState after admin approval

### Landing pages
Served at `/p/:slug` — server-rendered HTML from stored campaign JSON. Zero DNS, live instantly on publish.

---

## MCP Server (for AI assistants)

LaunchPad exposes its full campaign lifecycle as an [MCP](https://modelcontextprotocol.io) server embedded in the api-server at `POST /api/mcp` (Streamable HTTP transport). AI clients like Claude Desktop and Cursor can generate, revise, publish, pause, and monitor campaigns on a user's behalf, authenticated with a LaunchPad magic-link token (`Authorization: Bearer <token>`).

- Developer docs (tools, client config, safety): [`docs/mcp-server.md`](docs/mcp-server.md)
- In-app docs page: `/docs` (linked as "Developers" from the home page header)

> ⚠️ The `publish_campaign` and `pause_campaign` tools affect real spend and live ads. Publish returns a Stripe Checkout URL rather than charging silently.

## Pro Tier

$99/mo Pro is **never shown in the ship flow**. It surfaces only:
- In the account settings page
- When a user tries to start a second concurrent live campaign (one-line inline upsell)

Pro includes: 5% service fee, up to 5 simultaneous campaigns, custom domain. v1 ad channels are Meta, TikTok, and Google (LinkedIn is out of v1).
