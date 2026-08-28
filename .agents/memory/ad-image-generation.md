---
name: LaunchPad ad-image generation
description: Which image models power ad backgrounds and why
---

Ad-background images are generated in `artifacts/api-server/src/lib/imagePipeline.ts`.

**Quality path:** `gemini-3-pro-image-preview` (Nano Banana Pro) via `@workspace/integrations-gemini-ai/image`. Do not invoke this model until the CEO approves spend.

**Off-Replit:** the Gemini/OpenAI/Anthropic clients must NOT throw at module load. Auth is lazy. Accept `GEMINI_API_KEY` / `GOOGLE_API_KEY` (public `https://generativelanguage.googleapis.com`) **or** Replit `AI_INTEGRATIONS_GEMINI_*`. Same pattern for OpenAI (`OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_*`).

**Chain:** Gemini primary (edit when a product PNG exists, else text-to-image) → gpt-image-1 → **fail**. A branded SVG/gradient is not an ad. The UI says "Generation failed." `makeSvgFallbackKillOnSight` exists only as a labeled refuse sample.

**Crops:** three ads, one campaign. idx 0 hero 4:5 1080×1350, idx 1 context 9:16 1080×1920, idx 2 tight crop 4:5 1080×1350. Model is muted; compositor adds 2–6 word type in the top ~32% negative space.

**JPEG/PNG trap:** uploads are stored as JPEG (`uploads.ts`). Edit APIs declare `image/png`. `fetchProductImage` sharp-re-encodes to PNG so MIME matches bytes. Do not skip this. If fetch fails, log a warning and continue without the product photo (do not crash; do not silently swallow).
