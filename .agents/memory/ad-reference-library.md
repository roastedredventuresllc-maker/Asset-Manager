---
name: LaunchPad reference library + ad generation guidance
description: How curated 2026 ad/website references inform Claude generation, and the no-text rule for imagePrompts
---

`artifacts/api-server/src/lib/referenceLibrary.ts` holds curated, hand-written
ARCHETYPES (not real brand copy), placement specs, 2026 design principles, a
landing pattern, and per-ad slot contracts. `selectReferences()` scores by
keyword+vertical with a per-vertical diversity cap; `buildReferencePlaybook()`
emits a compact (<3k token, ~1.6k measured) prompt block.

**Decision — inject guidance via the system prompt, not the schema.** The
playbook is appended to `GENERATE_SYSTEM` in `claude.ts`; the user brief stays in
the user message as untrusted data. The `CampaignData` wire schema is left
UNCHANGED on purpose.
**Why:** changing the campaign schema ripples through OpenAPI codegen
(`lib/api-zod` + `lib/api-client-react`); keeping references in the prompt avoids
that entirely. Brief-in-user / playbook-in-system also gives prompt-injection
resistance.
**How to apply:** add/extend references or principles in `referenceLibrary.ts`;
never lift verbatim brand slogans into archetypes; don't add fields to
`CampaignData` just to carry guidance.

**Slot/idx contract:** ad idx 0 = Meta/IG feed 1:1, idx 1 = vertical 9:16
(Reels/Stories/TikTok — keep clear of right ~12% rail + bottom ~25% caption),
idx 2 = alternate feed 1:1. This MUST match the idx→placement mapping in
`imagePipeline.ts`.

**imagePrompts must be pure photography — three-layer no-text defense:**
1. system instruction tells Claude to write photo-only prompts;
2. `sanitizeImagePrompt()` in `claude.ts` strips positive text-render clauses
   (e.g. `tag reading 'X'`, `sign that says 'Y'`, standalone
   logo/watermark/typography/caption) from every ad on both generate AND revise;
3. the downstream PHOTO_STYLE suffix appends a hard "no text/words/letters"
   negative.
**Why:** Claude intermittently writes literal text into scenes (a tag/sign/label
"reading 'Limited Release'"), and AI-rendered text garbles; real typography is
composited separately downstream. The sanitizer is deliberately scoped to
explicit/quoted text — it does not try to catch every implicit reference (the
negative suffix is the backstop), to avoid mangling good prompts.

## Real indexed corpus (second guidance source, alongside the static playbook)

Generation guidance now comes from TWO sources, both appended to
`GENERATE_SYSTEM` in `claude.ts`:
1. the static hand-written playbook above (`referenceLibrary.ts` →
   `buildReferencePlaybook`), and
2. a REAL RAG corpus of vision-analysed ad images (`referenceAssets.ts` →
   `getIndexedReferenceNotes`), stored in the `reference_assets` table.

The real corpus is seeded at startup from `referenceSeed.ts` (idempotent by
`seedKey`; `ensureSeededInBackground` only seeds when the table is empty),
admin-managed (upload/delete/seed via `/api/admin/reference-assets`, all
`requireAdmin`), each image Claude-vision-analysed into the same
`ReferenceAnalysis` shape. Assets stuck in `analyzing` after a restart are
recovered on next boot (`recoverStaleAnalyzing` re-reads the stored image via
`getAsset` — no re-download).

**Why:** "real reference library, no blank cards" needed actual images, not CSS
placeholders; RAG (not fine-tuning) is how taste improves on the current stack.
**How to apply:** add curated seeds in `referenceSeed.ts`; keep BOTH guidance
sources in mind when editing the system prompt. Storage falls back to local FS
when no object-storage bucket is configured, and `imageUrl` is stored absolute
(dev-domain) — object storage IS now configured, so the corpus persists.

## Bulk-expanding the corpus (offline curation runbook + gotchas)

To add many real ads at once: imageSearch "<platform> ad examples" → download +
validate dimensions (magic-byte parser; **`sharp` is NOT importable in the
code_execution sandbox**) → vision-filter keeping only
`isAd && isSingleCreative && quality>=3` → dedupe against existing seed
`imageUrl`s → emit `{seedKey,platform,title,sourceUrl,imageUrl}` entries
(continue per-platform seedKey numbering) → append to `referenceSeed.ts` →
restart the api-server workflow (no dev watcher) → admin reseed:
`POST /api/admin/login {password:$ADMIN_PASSWORD}` → token in `x-admin-token` →
`POST /api/admin/reference-assets/seed` (idempotent by seedKey) → verify all
reach `status:"ready"` via `GET /api/admin/reference-assets`. The seed pipeline
does NOT reject non-ads — it analyses whatever you give it — so the vision gate
at curation time is what keeps quality up.

**Hard-won gotchas doing the offline vision step:**
- The Anthropic integration `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `_API_KEY`
  are **SECRETS** (`viewEnvVars` returns boolean presence only), so the
  code_execution sandbox CANNOT call the proxy. Run vision/LLM batch work as a
  **bash `node` script** where `process.env` has the values (raw `fetch` to
  `${BASE}/v1/messages`, headers `x-api-key` + `anthropic-version:2023-06-01`).
- The proxy poisons its connection pool under **concurrency ≥2** (requests
  stall/hang); run **concurrency 1**. A fresh process also has a warmup where the
  first several calls get rate-limited (429) then it warms through — shuffle the
  queue across passes so the same items don't always eat the warmup penalty.
- For long batch runs: the bash tool SIGKILLs foreground commands near its ~120s
  ceiling (and OOM-kills node when the 3 workflows are running). Launch the job
  **detached** (`setsid bash -c '… &'`, return immediately) and poll progress
  with short commands; make the script resumable (persist successes incrementally).
- **Never** `pkill -f <pattern>` when `<pattern>` also appears in your own bash
  command's argv (e.g. the script path) — it SIGKILLs your own shell (exit 137,
  no output). Kill by PID, or split the pattern with quotes.

## Background removal for product photos

`backgroundRemoval.ts` exports `removeBackground(imageUrl) → Buffer | null`.
Two-strategy approach:
1. **fal.ai BRIA RMBG 2.0** — dedicated model, best edge quality; used when
   `AI_INTEGRATIONS_FAL_API_KEY` / `FAL_KEY` / `FAL_API_KEY` is set.
2. **Gemini editImage fallback** — always available (existing integration);
   prompts Gemini to place subject on white, then sharp masks near-white pixels
   (>240 all channels) → transparent alpha.

`externalApi__falai` (managed billing) is **agent sandbox only** — cannot be
called from server-side Node code. fal.ai server-side needs explicit credentials
(`AI_INTEGRATIONS_FAL_*` or `FAL_KEY`); without them the Gemini fallback runs.

The upload route (`POST /api/uploads/product-image`) waits up to 30 s for BG
removal, then returns `{ url, noBgUrl }` — `noBgUrl` is null on timeout/failure.
The image pipeline (`imagePipeline.ts`) prefers `productImageNoBgUrl` over
`productImageUrl` for the hero ad composite (idx 0); other slots ignore it.
`productImageNoBgUrl` threads through job payloads; revisions recover it from
the most recent completed job (no DB migration needed).
