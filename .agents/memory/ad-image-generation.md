---
name: LaunchPad ad-image generation
description: Which image models power ad backgrounds and why
---

Ad-background images are generated in `artifacts/api-server/src/lib/imagePipeline.ts`.

**Quality path:** Grok Imagine (`xai/grok-imagine-image`) via Vercel AI Gateway, then `gpt-image-2` as a NEW plate. HARD NO on Gemini (`gemini-3-pro-image-preview` and any Gemini model). HARD NO on `gpt-image-1`.

**Chain:** Imagine once (edit/reference when a founder product PNG exists, else text-to-image) → Craft lock → if miss or reject, one NEW `gpt-image-2` plate (founder photo allowed as reference; never inpaint the typed Imagine frame) → **fail**. A branded SVG/gradient is not an ad. The UI says "Generation failed." `makeSvgFallbackKillOnSight` exists only as a labeled refuse sample.

**Craft lock (fail-closed, before composite):**
1. Any letter in the plate (fake label, sky type, garbled, baked headline) is reject. Do not crop it. Do not composite type over it.
2. Wet plastic sheen, over-smooth product, teal-orange grade, cinematic bloom: reject. One window light, real material.
3. Existing reject (not a photograph / flat gradient) still kills the frame.

**Crops:** three ads, one campaign. idx 0 hero 4:5 1080×1350, idx 1 context 9:16 1080×1920, idx 2 tight crop 4:5 1080×1350. Model is muted; compositor adds 2–6 word type in the top ~32% negative space only after Craft lock passes.

**JPEG/PNG trap:** uploads are stored as JPEG (`uploads.ts`). Edit APIs declare `image/png`. `fetchProductImage` sharp-re-encodes to PNG so MIME matches bytes. Do not skip this. If fetch fails, log a warning and continue without the product photo (do not crash; do not silently swallow).
