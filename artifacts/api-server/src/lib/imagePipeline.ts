import { db, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { uploadBuffer } from "./storage.js";
import { compositeAdImage, makeSvgFallback } from "./imageComposite.js";
import type { AspectRatio } from "@workspace/integrations-gemini-ai/image";
import type { CampaignAd } from "../ads/types.js";

interface GenerateImageJob {
  campaignId: string;
  adAssetId: string;
  idx: number;
  ad: CampaignAd;
  brandName: string;
  productImageUrl?: string | null;
  productImageNoBgUrl?: string | null;
}

// We composite clean, on-brand typography ourselves, so the AI image should be
// pure photography with no rendered text/logos (AI text tends to be garbled).
const PHOTO_STYLE =
  " Professional advertising product photography, photorealistic, sharp focus, high detail, studio-grade lighting, premium commercial campaign quality. Absolutely no text, no words, no letters, no logos, no watermarks.";

async function fetchProductImage(url: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const input = Buffer.from(await res.arrayBuffer());
    // Normalize to PNG so the edit calls' declared MIME type (image/png for
    // both Gemini inlineData and the OpenAI temp file) matches the real bytes.
    // Uploads are stored as JPEG, which would otherwise be a format mismatch.
    const { default: sharp } = await import("sharp");
    return await sharp(input).png().toBuffer();
  } catch {
    return undefined;
  }
}

/** Text-to-image with gpt-image-1. Square or portrait depending on the slot. */
async function generateWithOpenAI(
  prompt: string,
  portrait: boolean,
): Promise<Buffer | null> {
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server/image");
    const res = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt + PHOTO_STYLE,
      size: portrait ? "1024x1536" : "1024x1024",
      quality: "medium",
    });
    const b64 = res.data?.[0]?.b64_json;
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch (err) {
    logger.warn({ err }, "gpt-image-1 generation failed");
    return null;
  }
}

/** Image edit with gpt-image-1 — features the user's actual product photo. */
async function editWithOpenAI(
  productBuffer: Buffer,
  prompt: string,
): Promise<Buffer | null> {
  const tmpPath = join(tmpdir(), `product-${randomUUID()}.png`);
  try {
    const { editImages } = await import("@workspace/integrations-openai-ai-server/image");
    await writeFile(tmpPath, productBuffer);
    return await editImages([tmpPath], prompt + PHOTO_STYLE);
  } catch (err) {
    logger.warn({ err }, "gpt-image-1 edit failed");
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/**
 * Primary generator: Nano Banana (Google Gemini 2.5 Flash Image).
 * If `productBuffer` is provided, the scene is built around that real product
 * photo (image editing); otherwise it's pure text-to-image. Lazily imported so
 * a missing integration degrades to the OpenAI fallback instead of crashing.
 */
async function generateWithGemini(
  prompt: string,
  aspectRatio: AspectRatio,
  productBuffer?: Buffer,
): Promise<Buffer | null> {
  try {
    const gemini = await import("@workspace/integrations-gemini-ai/image");
    if (productBuffer) {
      return await gemini.editImage(
        prompt + PHOTO_STYLE,
        { data: productBuffer, mimeType: "image/png" },
        aspectRatio,
      );
    }
    return await gemini.generateImage(prompt + PHOTO_STYLE, aspectRatio);
  } catch (err) {
    logger.warn({ err }, "Nano Banana (gemini-2.5-flash-image) generation failed");
    return null;
  }
}

async function generateImageBuffer(
  job: GenerateImageJob,
): Promise<{ buffer: Buffer; model: string }> {
  const { ad, idx, productImageUrl, productImageNoBgUrl } = job;
  const portrait = idx === 1;
  const width = 1080;
  const height = portrait ? 1920 : 1080;
  const aspectRatio: AspectRatio = portrait ? "9:16" : "1:1";

  // Prefer the background-removed PNG (transparent cutout) for the hero ad
  // so the AI model composites the subject cleanly into the generated scene.
  // Fall back to the original photo if no-bg processing was unavailable.
  const heroImageUrl = productImageNoBgUrl ?? productImageUrl;
  const productBuffer = heroImageUrl
    ? await fetchProductImage(heroImageUrl)
    : undefined;

  // Hero ad (idx 0): if the user uploaded a product photo, build the scene
  // around it. Other slots are pure text-to-image.
  const useProductPhoto = idx === 0 && !!productBuffer;

  let raw: Buffer | null = null;
  let model = "";

  // Primary: Nano Banana (Gemini 2.5 Flash Image) — best-in-class generation.
  raw = await generateWithGemini(
    ad.imagePrompt,
    aspectRatio,
    useProductPhoto ? productBuffer : undefined,
  );
  if (raw) model = useProductPhoto ? "gemini-2.5-flash-image-edit" : "gemini-2.5-flash-image";

  // Fallback: gpt-image-1 (OpenAI) if Nano Banana is unavailable.
  if (!raw && useProductPhoto) {
    raw = await editWithOpenAI(productBuffer!, ad.imagePrompt);
    if (raw) model = "gpt-image-1-edit";
  }
  if (!raw) {
    raw = await generateWithOpenAI(ad.imagePrompt, portrait);
    if (raw) model = "gpt-image-1";
  }

  if (raw) {
    const finalBuffer = await compositeAdImage({
      ad,
      brandName: job.brandName,
      sourceImageBuffer: raw,
      width,
      height,
    });
    return { buffer: finalBuffer, model };
  }

  // Last-resort fallback: branded gradient (no image model available)
  logger.info({ adAssetId: job.adAssetId }, "Using SVG fallback for ad image");
  const svgBuffer = await makeSvgFallback({
    ad,
    brandName: job.brandName,
    sourceImageBuffer: productBuffer,
    width,
    height,
  });
  return { buffer: svgBuffer, model: "svg-fallback" };
}

export async function processImageJob(job: GenerateImageJob): Promise<void> {
  logger.info({ adAssetId: job.adAssetId, idx: job.idx }, "Processing image job");

  await db
    .update(adAssetsTable)
    .set({ status: "processing" })
    .where(eq(adAssetsTable.id, job.adAssetId));

  try {
    const { buffer, model } = await generateImageBuffer(job);
    const key = `ad-images/${job.campaignId}/${job.idx}.png`;
    const imageUrl = await uploadBuffer(key, buffer, "image/png");

    await db
      .update(adAssetsTable)
      .set({
        imageUrl,
        model,
        status: "done",
        format: job.idx === 1 ? "1080x1920" : "1080x1080",
      })
      .where(eq(adAssetsTable.id, job.adAssetId));

    logger.info({ adAssetId: job.adAssetId, imageUrl, model }, "Image job done");
  } catch (err) {
    logger.error({ err, adAssetId: job.adAssetId }, "Image job failed");

    await db
      .update(adAssetsTable)
      .set({ status: "failed" })
      .where(eq(adAssetsTable.id, job.adAssetId));
  }
}
