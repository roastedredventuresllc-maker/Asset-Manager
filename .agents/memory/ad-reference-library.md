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
