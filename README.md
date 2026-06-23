# LaunchPad

Founders describe their product, get a complete AI-generated ad campaign in 30 seconds, and push it live to Meta + TikTok — without ever touching an ad platform.

---

## Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure secrets

All secrets are set in Replit Secrets (the padlock icon in the sidebar). The app boots with only `ANTHROPIC_API_KEY` set — everything else is optional until you go live.

| Secret | Required | Where to get it |
|--------|----------|-----------------|
| `ANTHROPIC_API_KEY` | **Yes** | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `FAL_API_KEY` | Optional | [fal.ai/dashboard](https://fal.ai/dashboard) — falls back to SVG gradient ads if absent |
| `STRIPE_SECRET_KEY` | For payments | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Run `stripe listen` or add endpoint in Stripe dashboard |
| `META_SYSTEM_USER_TOKEN` | For Meta ads | See Meta setup below |
| `META_BUSINESS_ID` | For Meta ads | Meta Business Manager → Business Settings |
| `META_DEFAULT_PAGE_ID` | For Meta ads | Your Facebook Page ID |
| `TIKTOK_ACCESS_TOKEN` | For TikTok ads | See TikTok setup below |
| `TIKTOK_BC_ID` | For TikTok ads | TikTok Business Center ID |
| `TIKTOK_ADVERTISER_ID` | For TikTok ads | TikTok Ads Manager advertiser ID |
| `WORKER_SECRET` | Optional | Any random string — secures the job worker endpoint |

### 3. Environment variables

Set in Replit Secrets or `.env`:
```
ADS_MODE=mock   # "mock" (default) | "live"
```

### 4. Push database schema
```bash
pnpm --filter @workspace/db run push
```

### 5. Run the app
```bash
# API server (port assigned automatically)
pnpm --filter @workspace/api-server run dev

# Frontend (port assigned automatically)
pnpm --filter @workspace/launchpad run dev
```

---

## Mock Mode vs Live Mode

`ADS_MODE=mock` (the default) makes everything work end-to-end without any ad platform credentials:
- Campaign generation via Claude works immediately (only `ANTHROPIC_API_KEY` needed)
- Image generation via fal.ai works when `FAL_API_KEY` is set; falls back to SVG gradient ads otherwise
- Publishing logs realistic fake API request bodies and returns deterministic mock IDs/metrics
- Stripe checkout works with `STRIPE_SECRET_KEY`

**To go live**: set `ADS_MODE=live` in Replit Secrets once your Meta and TikTok approvals land. That's the only change needed.

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

Add a webhook endpoint at `https://your-domain.replit.app/api/webhooks/stripe` listening to:
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

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
- `META_BUSINESS_ID`: Business Settings → Business Info → Business Manager ID
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

---

## Scheduled Deployments (Crons)

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
- **AI**: Claude claude-sonnet-4-5 for generation + revision
- **Image gen**: fal.ai (FLUX 1.1 Pro, Ideogram v3, Gemini Flash Edit) with SVG fallback
- **Storage**: Replit Object Storage
- **Payments**: Stripe Checkout + subscriptions + metered usage
- **Ads**: Agency accounts on Meta + TikTok (mock mode by default)
- **Auth**: Magic links via email (no passwords ever)

### Data flow
1. User describes product → `POST /api/campaigns/generate` → Claude generates JSON → image jobs enqueued
2. Frontend polls `GET /api/campaigns/:id/status` every 3s until `status=ready`
3. Image worker (`POST /api/jobs/worker`) pulls pending jobs, calls fal.ai, composites with sharp, stores in Object Storage
4. User clicks Ship → `POST /api/campaigns/:id/publish` → Stripe Checkout
5. `checkout.session.completed` webhook → create user account, claim campaign, fire platform publish, send magic link
6. Frontend polls metrics every 30s

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

Pro includes: 5% service fee, up to 5 simultaneous campaigns, Google + LinkedIn channels, custom domain.
