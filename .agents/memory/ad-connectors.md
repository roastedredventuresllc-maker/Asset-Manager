---
name: Ad platform connectors
description: Why LaunchPad uses a self-managed credential model (not Replit OAuth) for ad platforms, and the durable rules/tradeoffs that govern it.
---

# Ad platform connectors

LaunchPad connects to Meta/TikTok/Google/LinkedIn through a **self-managed credential model**, not
Replit-managed OAuth connectors. A platform is "connected" when its required secret keys are
available from EITHER stored (encrypted, admin-entered) credentials OR server env vars.

**Why not Replit OAuth:** Meta/TikTok exist only as UNCONFIGURED Replit catalog connectors and
`REPLIT_CONNECTORS_HOSTNAME` is absent, so runtime Replit OAuth isn't viable; Google Ads + LinkedIn
have no Replit integration at all. One credential model works uniformly for all four.

**Durable rules / tradeoffs:**
- **`ADS_MODE` (default `mock`) — not connection status — controls mock-vs-live.** Saving credentials
  must NEVER flip to live. This is a deliberate safety boundary; preserve it in any refactor.
- **Stored credentials are encrypted with a key derived from `ADMIN_PASSWORD`.** Therefore rotating
  `ADMIN_PASSWORD` invalidates ALL stored credentials (they must be re-entered); env-var secrets are
  unaffected. `ADMIN_PASSWORD` protects both admin tokens AND credential encryption, so it must be
  strong. Decrypt failures degrade gracefully (treated as absent) and never log the secret.
- **"Connected" means keys are present/decryptable, NOT validated** — there is intentionally no
  platform-API validation (user declined it).
- **Never log or return secret VALUES** from any connector path (status/save/delete/publish errors).
  Status only ever exposes key names + presence + source. Admin UI uses blank inputs, never prefills.
- Live publishing is intentionally scoped to **Meta + TikTok only**; Google/LinkedIn are stubs that
  throw NOT_IMPLEMENTED, and the budget split covers only the implemented platforms.
- **`META_BUSINESS_ID` is misnamed — it holds the Meta *Ad Account* ID, not the Business ID.** The
  Meta client uses it directly in `/act_${META_BUSINESS_ID}/...` Marketing API paths. Setup
  instructions must tell operators to copy the **Ad Account ID** (digits only, from Business
  Settings → Accounts → Ad Accounts), NOT the Business ID, or live publishing 404s.
- **Connector `setupSteps` are structured `{ text, link? }` (not plain strings)** in
  `ads/connectors.ts`; the admin Connectors UI renders each step's optional link as a button. The
  `/api/admin/connectors` endpoint is hand-typed (plain `res.json`, NOT openapi codegen), so the
  `ConnectorStatus`/`SetupStep` types must be kept in sync manually between backend and admin.tsx.
