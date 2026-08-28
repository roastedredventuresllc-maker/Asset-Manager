# LaunchPad

Founders describe their product, get a complete AI-generated ad campaign in 30 seconds, and push it live to Meta, TikTok, and Google — without ever touching an ad platform.

---

## Setup

### Boot locally (`ADS_MODE=mock`, no Replit)

Postgres is required for `db push` and the API. House ad accounts stay test-only; this path does not flip live or spend.

```bash
pnpm install
cp .env.example .env          # names only — fill keys you have; leave the rest blank
docker compose up -d --wait   # local Postgres at 127.0.0.1:5432 (user/db: launchpad)
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev    # API, default 8080
pnpm --filter @workspace/launchpad run dev     # frontend, 5173, proxies /api
```

If `DATABASE_URL` is unset off Replit, drizzle and the API use `postgres://launchpad:launchpad@127.0.0.1:5432/launchpad` (the compose database). Put a real URL in `.env` when you are not using compose. Keep `ADS_MODE=mock`.

Confirm the API: `curl -s http://127.0.0.1:8080/api/healthz` → `{"status":"ok"}`.

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure secrets

Secrets live in Replit Secrets (padlock) or a repo-root `.env`. The API will not boot without `DATABASE_URL`. Campaign copy is written by Grok from the founder prompt — set `XAI_API_KEY`. No Anthropic key is required to generate or revise. Everything else is optional until you go live.

| Secret | Required | Where to get it |
|--------|----------|-----------------|
| `DATABASE_URL` | **Yes** (API boot) | Postgres connection string |
| `PORT` | API listen (Vite on Replit too) | Local default 8080 for the API if unset |
| `BASE_PATH` | Vite base | Local default `/` if unset |
| `XAI_API_KEY` | **Yes** for copy | [console.x.ai](https://console.x.ai) → API Keys. Grok writes generate + revise from the founder prompt. |
| `XAI_BASE_URL` | Optional | Defaults to `https://api.x.ai/v1` |
| `XAI_MODEL` | Optional | Defaults to `grok-4.6` (JSON chat) |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Optional | Reference-image vision only. Not required to generate. |
| `GEMINI_API_KEY` | For photoreal ads (or `AI_INTEGRATIONS_GEMINI_API_KEY`) | [aistudio.google.com](https://aistudio.google.com) → API keys. Quality path is `gemini-3-pro-image-preview`. |
| `OPENAI_API_KEY` | Fallback images (or `AI_INTEGRATIONS_OPENAI_API_KEY`) | [platform.openai.com](https://platform.openai.com) → API keys |
| `FAL_API_KEY` | Optional | [fal.ai/dashboard](https://fal.ai/dashboard) — background removal only |
| `STRIPE_SECRET_KEY` | For payments | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Run `stripe listen` or add endpoint in Stripe dashboard |
| `ADMIN_PASSWORD` | Admin + encrypted connectors | Any strong password |
| `META_SYSTEM_USER_TOKEN` | For Meta ads | See Meta setup below |
| `META_BUSINESS_ID` | House/test Meta ads | **Ad Account ID** (digits only, no `act_` prefix), not the Business Manager ID. Client brands use per-customer IDs, not this house ID. |
| `META_DEFAULT_PAGE_ID` | For Meta ads | Your Facebook Page ID |
| `TIKTOK_ACCESS_TOKEN` | For TikTok ads | See TikTok setup below |
| `TIKTOK_BC_ID` | For TikTok ads | TikTok Business Center ID |
| `TIKTOK_ADVERTISER_ID` | House/test TikTok ads | TikTok Ads Manager advertiser ID (LaunchPad tests only) |
| `TIKTOK_IDENTITY_ID` | House/test TikTok ads | Verified **CUSTOMIZED_USER** identity ID (required for image ads) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | For Google Ads | Google Ads API Center |
| `GOOGLE_ADS_CLIENT_ID` | For Google Ads | Google Cloud OAuth client |
| `GOOGLE_ADS_CLIENT_SECRET` | For Google Ads | Google Cloud OAuth client |
| `GOOGLE_ADS_REFRESH_TOKEN` | For Google Ads | OAuth Playground, AdWords scope |
| `GOOGLE_ADS_CUSTOMER_ID` | House/test Google Ads | House/test Customer ID (digits; dashes stripped). Clients have their own Customer ID. |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC | Manager account customer ID — stays house; used as login-customer-id for every client |
| `WORKER_SECRET` | Optional | Any random string — secures the job worker endpoint |

### 3. Environment variables

Copy `.env.example` to `.env` in the repo root. Names only — no values in the example except `ADS_MODE=mock`. The API loads `.env` on boot if present (existing env/Replit Secrets win). Vite reads the same file (`envDir` = repo root).

```
ADS_MODE=mock
```

`ADMIN_PASSWORD` is required for `/admin`. Without it, admin login returns 503.

Local Stripe return uses `PUBLIC_APP_URL` if set, otherwise Vite (`http://127.0.0.1:5173`). If the webhook has not flipped status yet, Home still shows ReviewState (not the ship UI) while status is `publishing`.

### 4. Push database schema
```bash
pnpm --filter @workspace/db run push
```

### 5. Run the app
```bash
# API server (API_PORT, default 8080). Loads repo-root .env.
pnpm --filter @workspace/api-server run dev

# Frontend (5173 locally; proxies /api to the API)
pnpm --filter @workspace/launchpad run dev
```

Local asset URLs are relative `/api/assets/...` (browser + Vite proxy). Do not expect `https://localhost`.

---

## Mock Mode vs Live Mode

`ADS_MODE=mock` (the default) makes publishing work end-to-end without spending:
- Campaign copy: Grok writes generate + revise from the founder prompt when `XAI_API_KEY` is set. No Anthropic key required.
- Image generation uses `gemini-3-pro-image-preview`, then `gpt-image-1`. If both miss, the job **fails** — a branded gradient is not an ad
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

After deploying, set up four scheduled deployments in Replit:

| Name | URL | Schedule | Purpose |
|------|-----|----------|---------|
| Image Worker | `POST /api/jobs/worker` | Every 1 min | Process image generation queue |
| Metrics Snapshot | `GET /api/campaigns/{id}/metrics` | Every 15 min | Refresh campaign metrics |
| Spend Reconciliation | custom | Nightly | Report metered Stripe usage |
| Weekly Summary | custom | Weekly | Email campaign summaries (stub — logs in v1) |

Add `X-Worker-Secret: <your WORKER_SECRET>` header to secure the worker endpoint.

---

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui — one page, six states
- **Backend**: Express 5 + Node.js 24 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **AI copy**: Grok (`XAI_API_KEY`, `https://api.x.ai/v1`) writes generate + revise from the founder prompt. Not a template composer.
- **Image gen**: `gemini-3-pro-image-preview` then `gpt-image-1`. Fail-closed — a branded gradient is not an ad. Type is composited in designed negative space.
- **Storage**: Replit Object Storage
- **Payments**: Stripe Checkout + subscriptions + metered usage
- **Ads**: Meta + TikTok + Google (mock mode by default; LinkedIn is out of v1)
- **Auth**: Magic links via email (no passwords ever)

### Data flow
1. User describes the product → `POST /api/campaigns/generate` → Grok writes campaign JSON from that prompt → image jobs enqueued
2. Frontend polls `GET /api/campaigns/:id/status` until copy is ready; images finish as background jobs (`gemini-3-pro-image-preview` then `gpt-image-1`, fail-closed)
3. In-process worker drains `generate_image` jobs (optional external cron: `POST /api/jobs/worker`)
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
