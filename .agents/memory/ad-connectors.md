---
name: Ad platform connectors
description: Why LaunchPad uses a self-managed credential model (not Replit OAuth) for ad platforms, and the durable rules/tradeoffs that govern it.
---

# Ad platform connectors

LaunchPad connects to Meta/TikTok/Google through a **self-managed credential model**, not
Replit-managed OAuth connectors. A platform is "connected" when its required secret keys are
available from EITHER stored (encrypted, admin-entered) credentials OR server env vars.

**Why not Replit OAuth:** Meta/TikTok exist only as UNCONFIGURED Replit catalog connectors and
`REPLIT_CONNECTORS_HOSTNAME` is absent, so runtime Replit OAuth isn't viable; Google Ads has no
Replit integration. One credential model works uniformly for v1 channels.

**Durable rules / tradeoffs:**
- **House `META_*` / `TIKTOK_*` / `GOOGLE_*` env (and Admin → Connectors) is LaunchPad's own
  test accounts only.** Client brands publish to per-customer Meta Ad Account IDs (Business On
  Behalf Of), TikTok advertiser IDs (partner access), and Google Ads Customer IDs under our MCC
  (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`). Never overlay a client campaign onto house IDs — fail closed.
- **`ADS_MODE` (default `mock`) — not connection status — controls mock-vs-live.** Saving credentials
  must NEVER flip to live. This is a deliberate safety boundary; preserve it in any refactor.
- **Stored credentials are encrypted with a key derived from `ADMIN_PASSWORD`.** Therefore rotating
  `ADMIN_PASSWORD` invalidates ALL stored credentials (they must be re-entered); env-var secrets are
  unaffected. `ADMIN_PASSWORD` protects both admin tokens AND credential encryption, so it must be
  strong. Decrypt failures degrade gracefully (treated as absent) and never log the secret.
- **"Connected" means keys are present/decryptable.** Optional read-only Verify (no spend) may
  authenticate; it must never publish and never write `ADS_MODE`.
- **Never log or return secret VALUES** from any connector path (status/save/delete/verify/publish errors).
  Status only ever exposes key names + presence + source. Admin UI uses blank inputs, never prefills.
- **v1 ship channels are Meta + TikTok + Google.** LinkedIn stays unimplemented and is hidden from
  Connectors (`v1: false`). Budget split includes Google.
- **`META_BUSINESS_ID` is misnamed — it holds the Meta *Ad Account* ID, not the Business ID.** The
  Meta client uses it directly in `/act_${META_BUSINESS_ID}/...` Marketing API paths. Setup
  instructions must tell operators to copy the **Ad Account ID** (digits only, from Business
  Settings → Accounts → Ad Accounts), NOT the Business ID, or live publishing 404s.
- **Connector `setupSteps` are structured `{ text, link? }` (not plain strings)** in
  `ads/connectors.ts`; the admin Connectors UI renders each step's optional link as a button. The
  `/api/admin/connectors` endpoint is hand-typed (plain `res.json`, NOT openapi codegen), so the
  `ConnectorStatus`/`SetupStep` types must be kept in sync manually between backend and admin.tsx.
