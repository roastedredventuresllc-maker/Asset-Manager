---
name: LaunchPad paid-social & AI keys
description: How to test the Meta/TikTok publish flow without payment, and which AI keys are wired vs. optional.
---

# Paid-social testing & AI providers

- `ADS_MODE` defaults to `mock`. In mock mode, publishing to Meta/TikTok returns
  fake external IDs and metrics endpoints return synthetic numbers — no real
  ad-platform credentials needed.
- The real publish path goes through Stripe checkout → webhook → `publishCampaignToPlatforms`.
  To exercise the publish pipeline **without Stripe**, there is a DEV-ONLY endpoint
  `POST /api/campaigns/:id/test-publish` that calls the same shared function. It is
  gated: returns **403 when `NODE_ENV === "production"`**. Keep that gate.
- The publish pipeline lives in `lib/publish.ts` and is shared by both the Stripe
  webhook (real flow) and test-publish. It attaches generated image URLs from
  `adAssetsTable` onto each ad before handing to the platform adapter.
- **AI providers:** Claude is wired via the Replit AI Integration
  (`@workspace/integrations-anthropic-ai`) — no user API key required; generation
  is ~15–25s. Real photographic ad images need `FAL_API_KEY`, for which **no Replit
  integration exists** — it must be supplied as a plain secret. Without it the app
  falls back to SVG gradient images (functional, lower fidelity).
- TikTok live ads require `TIKTOK_IDENTITY_ID` (identity_type CUSTOMIZED_USER) and
  use `SINGLE_IMAGE` creatives (image uploaded via UPLOAD_BY_URL to get an image_id).
