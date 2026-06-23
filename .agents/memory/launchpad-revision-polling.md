---
name: LaunchPad campaign revision + image polling
description: Why ad-image regeneration must be serialized and why resetting assets requires query invalidation.
---

# LaunchPad: ad-image regeneration & status polling

LaunchPad generates 3 ad images per campaign as async worker jobs. The review UI
(home.tsx `BriefingState`) shows them by polling the getCampaignStatus endpoint.

## Rule 1 — polling keys off adAsset.status, not campaign.status
The frontend `refetchInterval` keeps polling while the campaign is
generating/publishing OR any `adAsset.status` is not in `(done, failed)`. It
stops once every asset is terminal.

**Why:** images finish *after* the campaign row is already `ready/draft`. Polling
that watched only campaign.status stopped too early and the generated images never
appeared (the original "no images" bug).

**How to apply:** any server path that resets ad assets to `pending` (e.g.
`reviseCampaignById` when visuals change) MUST be followed on the client by
invalidating BOTH the status and campaign query keys, or the interval — already
stopped because everything was `done` — never restarts and new images never show.

## Rule 2 — revisions must be serialized against in-flight image jobs
There is NO per-job / per-asset version token. `reviseCampaignById` resets the
same adAsset rows to `pending` and enqueues new `generate_image` jobs, but any
old in-flight job can still complete and overwrite those rows with stale
image/status.

**Why:** without a version token, a stale completion can flip an asset back to
`done` with the old image while the revised job is still pending, and polling can
stop on the stale state.

**How to apply:** block all revision entry points while any asset is regenerating
(home.tsx gates every FeedbackButton + the RevisionSheet input on
`assetsGenerating`). If you ever add per-asset regeneration or relax this gate,
add a generation/version token to asset rows + job payloads and have the worker
write only when the token still matches.
