---
name: Ad platform connectors
description: How LaunchPad models ad-platform connections (Meta, TikTok, Google Ads, LinkedIn), credential storage, and why Replit-managed OAuth was not used.
---

# Ad platform connectors

LaunchPad connects to ad platforms through a **unified connector model** with TWO credential
sources, not Replit-managed OAuth connectors. Each platform declares its required (and optional)
secret KEY NAMES in `ads/connectors.ts` (CONNECTOR_SPECS). A platform is **"connected" when all
required keys are available from EITHER stored encrypted DB credentials OR the server environment**.
`connectorStatuses()` is async, reports which keys are present and the `source` (`stored` | `env` |
`none`), and never returns values.

**Why:** Meta/TikTok exist only as UNCONFIGURED Replit catalog connectors and
`REPLIT_CONNECTORS_HOSTNAME` is absent, so runtime Replit OAuth is not viable here. Google Ads +
LinkedIn have no Replit integration at all. A credential model works uniformly for all four and
matches what the live clients (`ads/meta.ts`, `ads/tiktok.ts`) read.

**How to apply:**
- Operators can EITHER enter credentials in the admin UI (encrypted at rest, see below) OR set them
  as server env vars. The UI uses blank password inputs and NEVER prefills/echoes secret values.
- Credentials at rest: `platform_credentials` table (platform PK, encrypted_data jsonb). Encryption
  is AES-256-GCM, key = scryptSync(ADMIN_PASSWORD, per-row random 16-byte salt, 32), envelope
  `{v,alg,salt,iv,tag,ciphertext}` hex. `resolveCredentials` is DB-first then per-key env fallback,
  restricted to CONNECTOR_SPECS keys. Saving merges non-empty values over existing.
- **Rotating ADMIN_PASSWORD invalidates all stored credentials** (key is derived from it). Decrypt
  failures return null and log without the secret; operators must re-enter creds after a rotation.
- `getAdPlatform()` is async; mock path (default) uses no creds. `ADS_MODE` (default `mock`) controls
  mock-vs-live — NOT connection status, and **saving credentials does NOT flip to live**.
- No platform-API validation: "connected" means keys are present/decryptable, not that they're valid.
- Live publishing is implemented for Meta/TikTok only; `ads/google.ts` + `ads/linkedin.ts` throw
  NOT_IMPLEMENTED, and `lib/publish.ts` budget split intentionally covers meta/tiktok only.
- Never log or return secret values from any connector path (status, save, delete, publish errors).
