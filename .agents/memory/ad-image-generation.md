---
name: LaunchPad ad-image generation
description: Which image models power ad backgrounds and why
---

Ad-background images are generated in `artifacts/api-server/src/lib/imagePipeline.ts`.

**Decision:** "Nano Banana" = Google Gemini 2.5 Flash Image (`gemini-2.5-flash-image`), accessed via the Replit Gemini AI integration (no own API key; billed to Replit credits). Higgsfield was requested by the user but is NOT a supported Replit integration, so it was not used.

**Chain:** Nano Banana primary (multimodal edit path for the hero slot when a product photo exists, else text-to-image) → gpt-image-1 (OpenAI) fallback → SVG last resort. Both integration imports are lazy/dynamic so a missing env degrades to the next tier instead of crashing the worker.

**Quality upgrade path:** swap the model to `gemini-3-pro-image-preview` (Nano Banana Pro) for higher quality at higher cost.

**Why the PNG normalization:** uploaded product images are stored as JPEG (`uploads.ts`), but the edit calls declare `image/png` (Gemini inlineData + OpenAI temp file). `fetchProductImage` re-encodes the fetched bytes to PNG via sharp so the declared MIME always matches the real bytes — otherwise edits can fail or silently degrade to text-to-image, losing the user's product photo.
