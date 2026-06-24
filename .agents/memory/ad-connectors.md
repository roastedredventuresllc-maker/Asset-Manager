---
name: Ad platform connectors
description: How LaunchPad models ad-platform connections (Meta, TikTok, Google Ads, LinkedIn) and why Replit-managed OAuth was not used.
---

# Ad platform connectors

LaunchPad connects to ad platforms through a **unified, secrets-based connector model**, not
Replit-managed OAuth connectors. Each platform declares its required (and optional) secret KEY
NAMES in `ads/connectors.ts` (CONNECTOR_SPECS). "Connected" means **all required env vars are
present** — `connectorStatuses()` checks `process.env[key]` presence only and returns names +
booleans, never values. The admin UI + `GET /api/admin/connectors` surface this status.

**Why:** Meta/TikTok exist only as UNCONFIGURED Replit catalog connectors
(`connector_catalog:facebook`, `connector_catalog:tiktok-ads`, requires_setup) and
`REPLIT_CONNECTORS_HOSTNAME` is absent, so runtime Replit OAuth is not viable in this project.
Google Ads + LinkedIn have no Replit integration at all. A secrets-based model works uniformly for
all four and matches what the existing live clients (`ads/meta.ts`, `ads/tiktok.ts`) already read.

**How to apply:**
- Operators add credentials via the Replit Secrets pane; the UI never accepts secret input.
- `ADS_MODE` (default `mock`) controls mock-vs-live behavior — NOT connection status. Presence of
  secrets alone does not switch to live; `ADS_MODE=live` is required.
- "Connected" only means secrets are SET, not that they are valid (no live credential check yet).
- Live publishing is implemented for Meta/TikTok only; `ads/google.ts` + `ads/linkedin.ts` throw
  NOT_IMPLEMENTED, and `lib/publish.ts` budget split intentionally covers meta/tiktok only.
- Never log or return secret values from the connector status path.
