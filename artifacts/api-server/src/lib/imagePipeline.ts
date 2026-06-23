import { db, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { uploadBuffer } from "./storage.js";
import { compositeAdImage, makeSvgFallback } from "./imageComposite.js";
import { openai, editImages } from "@workspace/integrations-openai-ai-server/image";
import type { CampaignAd } from "../ads/types.js";

interface GenerateImageJob {
  campaignId: string;
  adAssetId: string;
  idx: number;
  ad: CampaignAd;
  brandName: string;
  productImageUrl?: string | null;
}

// We composite clean, on-brand typography ourselves, so the AI image should be
// pure photography with no rendered text/logos (AI text tends to be garbled).
const PHOTO_STYLE =
  " Professional advertising product photography, photorealistic, sharp focus, high detail, studio-grade lighting, premium commercial campaign quality. Absolutely no text, no words, no letters, no logos, no watermarks.";

async function fetchProductImage(url: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
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
    await writeFile(tmpPath, productBuffer);
    return await editImages([tmpPath], prompt + PHOTO_STYLE);
  } catch (err) {
    logger.warn({ err }, "gpt-image-1 edit failed");
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function generateImageBuffer(
  job: GenerateImageJob,
): Promise<{ buffer: Buffer; model: string }> {
  const { ad, idx, productImageUrl } = job;
  const portrait = idx === 1;
  const width = 1080;
  const height = portrait ? 1920 : 1080;

  const productBuffer = productImageUrl
    ? await fetchProductImage(productImageUrl)
    : undefined;

  let raw: Buffer | null = null;
  let model = "gpt-image-1";

  // Hero ad: if the user uploaded a product photo, build the scene around it.
  if (idx === 0 && productBuffer) {
    raw = await editWithOpenAI(productBuffer, ad.imagePrompt);
    if (raw) model = "gpt-image-1-edit";
  }

  if (!raw) {
    raw = await generateWithOpenAI(ad.imagePrompt, portrait);
    model = "gpt-image-1";
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
