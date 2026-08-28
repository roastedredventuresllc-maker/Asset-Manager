import { db, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { uploadBuffer } from "./storage.js";
import { compositeAdImage } from "./imageComposite.js";
import { reencodeToPng, EDIT_MIME } from "./imageMime.js";
import {
  buildCraftPrompt,
  rejectIfFlatGradient,
  rejectIfNotAPhotograph,
  slotForIndex,
  ImageGenerationFailed,
  CraftReject,
  GEMINI_IMAGE_MODEL,
  type AdSlot,
} from "./craft.js";
import type { CampaignAd } from "../ads/types.js";

export interface GenerateImageJob {
  campaignId: string;
  adAssetId: string;
  idx: number;
  ad: CampaignAd;
  brandName: string;
  productImageUrl?: string | null;
  productImageNoBgUrl?: string | null;
}

export interface ImageGenerators {
  generateWithGemini: (
    prompt: string,
    slot: AdSlot,
    productPng?: Buffer,
  ) => Promise<Buffer | null>;
  generateWithOpenAI: (
    prompt: string,
    slot: AdSlot,
    productPng?: Buffer,
  ) => Promise<Buffer | null>;
}

async function fetchProductImage(url: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(
        { status: res.status, host: safeHost(url) },
        "Product photo fetch missed — continuing without it (not silently dropped)",
      );
      return undefined;
    }
    const input = Buffer.from(await res.arrayBuffer());
    // JPEG/PNG trap: uploads are JPEG. Edit calls declare PNG. Re-encode.
    return await reencodeToPng(input);
  } catch (err) {
    logger.warn(
      { err, host: safeHost(url) },
      "Product photo fetch missed — continuing without it (not silently dropped)",
    );
    return undefined;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

async function defaultGemini(
  prompt: string,
  slot: AdSlot,
  productPng?: Buffer,
): Promise<Buffer | null> {
  try {
    const gemini = await import("@workspace/integrations-gemini-ai/image");
    if (!gemini.isGeminiImageConfigured()) return null;
    if (productPng) {
      return await gemini.editImage(
        prompt,
        { data: productPng, mimeType: EDIT_MIME },
        slot.aspectRatio,
      );
    }
    return await gemini.generateImage(prompt, slot.aspectRatio);
  } catch (err) {
    logger.warn({ err, model: GEMINI_IMAGE_MODEL }, "Gemini image generation missed");
    return null;
  }
}

async function defaultOpenAI(
  prompt: string,
  slot: AdSlot,
  productPng?: Buffer,
): Promise<Buffer | null> {
  try {
    const openai = await import("@workspace/integrations-openai-ai-server/image");
    if (!openai.isOpenAIImageConfigured()) return null;
    if (productPng) {
      const tmpPath = join(tmpdir(), `product-${randomUUID()}.png`);
      try {
        await writeFile(tmpPath, productPng);
        return await openai.editImages([tmpPath], prompt);
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    }
    const portrait = slot.aspectRatio === "9:16" || slot.aspectRatio === "4:5";
    return await openai.generateImageBuffer(prompt, portrait ? "1024x1536" : "1024x1024");
  } catch (err) {
    logger.warn({ err }, "gpt-image-1 generation missed");
    return null;
  }
}

export const defaultImageGenerators: ImageGenerators = {
  generateWithGemini: defaultGemini,
  generateWithOpenAI: defaultOpenAI,
};

/**
 * Generate one campaign ad photograph. Fail-closed:
 * Gemini miss → gpt-image-1 → FAILED. Never an SVG/gradient.
 */
export async function generateImageBuffer(
  job: GenerateImageJob,
  generators: ImageGenerators = defaultImageGenerators,
): Promise<{ buffer: Buffer; model: string }> {
  const slot = slotForIndex(job.idx);
  const heroImageUrl = job.productImageNoBgUrl ?? job.productImageUrl;
  const productPng = heroImageUrl ? await fetchProductImage(heroImageUrl) : undefined;
  const hasProductPhoto = !!productPng;

  const prompt = buildCraftPrompt({
    ad: job.ad,
    slot,
    brandName: job.brandName,
    hasProductPhoto,
  });

  let raw: Buffer | null = null;
  let model = "";

  raw = await generators.generateWithGemini(
    prompt,
    slot,
    hasProductPhoto ? productPng : undefined,
  );
  if (raw) {
    model = hasProductPhoto
      ? `${GEMINI_IMAGE_MODEL}-edit`
      : GEMINI_IMAGE_MODEL;
  }

  if (!raw) {
    raw = await generators.generateWithOpenAI(
      prompt,
      slot,
      hasProductPhoto ? productPng : undefined,
    );
    if (raw) model = hasProductPhoto ? "gpt-image-1-edit" : "gpt-image-1";
  }

  if (!raw) {
    throw new ImageGenerationFailed(
      "Generation failed. Gemini and gpt-image-1 both missed. A branded gradient is not an ad.",
    );
  }

  rejectIfNotAPhotograph(raw);
  await rejectIfFlatGradient(raw);

  const finalBuffer = await compositeAdImage({
    ad: job.ad,
    brandName: job.brandName,
    sourceImageBuffer: raw,
    width: slot.width,
    height: slot.height,
  });

  return { buffer: finalBuffer, model };
}

export async function processImageJob(
  job: GenerateImageJob,
  generators: ImageGenerators = defaultImageGenerators,
): Promise<void> {
  const slot = slotForIndex(job.idx);
  logger.info({ adAssetId: job.adAssetId, idx: job.idx, role: slot.role }, "Processing image job");

  await db
    .update(adAssetsTable)
    .set({ status: "processing" })
    .where(eq(adAssetsTable.id, job.adAssetId));

  try {
    const { buffer, model } = await generateImageBuffer(job, generators);
    const key = `ad-images/${job.campaignId}/${job.idx}.png`;
    const imageUrl = await uploadBuffer(key, buffer, "image/png");

    await db
      .update(adAssetsTable)
      .set({
        imageUrl,
        model,
        status: "done",
        format: slot.format,
      })
      .where(eq(adAssetsTable.id, job.adAssetId));

    logger.info({ adAssetId: job.adAssetId, imageUrl, model }, "Image job done");
  } catch (err) {
    const craft = err instanceof CraftReject || err instanceof ImageGenerationFailed;
    logger.error({ err, adAssetId: job.adAssetId, craft }, "Image job failed");

    await db
      .update(adAssetsTable)
      .set({
        status: "failed",
        imageUrl: null,
        model: null,
      })
      .where(eq(adAssetsTable.id, job.adAssetId));

    throw err;
  }
}
