---
name: LaunchPad asset URL ↔ route contract
description: How generated ad images are stored and served; the invariant that ties storage URLs to the assets route.
---

# Asset storage/serving contract

`lib/storage.ts` writes generated ad images **local-first** (`/tmp/launchpad-assets`)
and falls back to Replit Object Storage. It returns public URLs of the form
`https://<domain>/api/assets/<key>` where `<key>` contains slashes
(e.g. `ad-images/<campaignId>/0.png`).

**Invariant:** those URLs are only valid because the `assets` route is mounted at
`/api/assets` and reads the full key from `req.path` (not a single `:param`, since
keys contain slashes). `getAsset(key)` mirrors the write order: local fs first,
then Object Storage.

**Why:** there was a critical bug where storage handed out `/api/assets/*` URLs
but no route served them → every generated image 404'd. If you ever change the URL
scheme in storage.ts, update the route (and `getAsset`) in lockstep, or images break
again.

**How to apply:** `getAsset` rejects path traversal (`normalize` + strip leading
`../` + reject any remaining `..`). Keep that guard if you touch the lookup.
