import { db, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { uploadBuffer } from "./storage.js";
import { compositeAdImage } from "./imageComposite.js";
import { reencodeToPng } from "./imageMime.js";
import { resolveFetchableUrl } from "./assetUrl.js";
import {
  buildCraftPrompt,
  assertCraftPlate,
  slotForIndex,
  ImageGenerationFailed,
  CraftReject,
  GROK_IMAGINE_MODEL,
  GPT_IMAGE_FALLBACK_MODEL,
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
  generateWithImagine: (
    prompt: string,
    slot: AdSlot,
    productPng?: Buffer,
  ) => Promise<Buffer | null>;
  generateWithGptImage2: (
    prompt: string,
    slot: AdSlot,
    productPng?: Buffer,
  ) => Promise<Buffer | null>;
}

async function fetchProductImage(url: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(resolveFetchableUrl(url));
    if (!res.ok) {
      logger.warn(
        { status: res.status, host: safeHost(url) },
        "Product photo fetch missed — continuing without it (not silently dropped)",
      );
      return undefined;
    }
    const input = Buffer.from(await res.arrayBuffer());
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

/** Imagine rejects 4:5. Hero / tight crop use 3:4; context stays 9:16. */
export function imagineAspect(slot: AdSlot): "3:4" | "9:16" {
  return slot.aspectRatio === "9:16" ? "9:16" : "3:4";
}

async function defaultImagine(
  prompt: string,
  slot: AdSlot,
  productPng?: Buffer,
): Promise<Buffer | null> {
  try {
    const xai = await import("@workspace/integrations-xai");
    if (!xai.isImagineConfigured()) return null;
    const aspect = imagineAspect(slot);
    if (productPng) {
      return await xai.editImagineImage(prompt, productPng, aspect);
    }
    return await xai.generateImagineImage(prompt, aspect);
  } catch (err) {
    logger.warn(
      { err, model: GROK_IMAGINE_MODEL, message: err instanceof Error ? err.message : String(err) },
      "Grok Imagine missed",
    );
    return null;
  }
}

async function defaultGptImage2(
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
    logger.warn(
      { err, model: GPT_IMAGE_FALLBACK_MODEL, message: err instanceof Error ? err.message : String(err) },
      "gpt-image-2 missed",
    );
    return null;
  }
}

export const defaultImageGenerators: ImageGenerators = {
  generateWithImagine: defaultImagine,
  generateWithGptImage2: defaultGptImage2,
};

type PlateAttempt = {
  raw: Buffer | null;
  reject?: string;
};

async function acceptOrNull(
  raw: Buffer | null,
  label: string,
): Promise<PlateAttempt> {
  if (!raw) return { raw: null };
  try {
    await assertCraftPlate(raw);
    return { raw };
  } catch (err) {
    const reject =
      err instanceof CraftReject
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    logger.warn({ err, label, reject }, "Craft lock rejected plate");
    return { raw: null, reject };
  }
}

/**
 * Generate one campaign ad photograph. Fail-closed:
 * Grok Imagine once → if miss or Craft reject, one NEW gpt-image-2 plate → FAILED.
 * Never Gemini. Never SVG/gradient. Never composite type over a rejected plate.
 */
export async function generateImageBuffer(
  job: GenerateImageJob,
  generators: ImageGenerators = defaultImageGenerators,
): Promise<{ buffer: Buffer; model: string }> {
  const slot = slotForIndex(job.idx);
  const heroImageUrl = job.productImageNoBgUrl ?? job.productImageUrl;
  const productPng = heroImageUrl ? await fetchProductImage(heroImageUrl) : undefined;
  const hasProductPhoto = !!productPng;
  const founderPng = hasProductPhoto ? productPng : undefined;

  const prompt = buildCraftPrompt({
    ad: job.ad,
    slot,
    brandName: job.brandName,
    hasProductPhoto,
  });

  const imagine = await acceptOrNull(
    await generators.generateWithImagine(prompt, slot, founderPng),
    GROK_IMAGINE_MODEL,
  );
  let raw = imagine.raw;
  let model = raw
    ? hasProductPhoto
      ? `${GROK_IMAGINE_MODEL}-edit`
      : GROK_IMAGINE_MODEL
    : "";

  let gpt: PlateAttempt = { raw: null };
  if (!raw) {
    // NEW plate. Founder product photo is allowed as reference.
    // The rejected Imagine buffer is not passed — not a rescue/inpaint.
    gpt = await acceptOrNull(
      await generators.generateWithGptImage2(prompt, slot, founderPng),
      GPT_IMAGE_FALLBACK_MODEL,
    );
    raw = gpt.raw;
    if (raw) {
      model = hasProductPhoto
        ? `${GPT_IMAGE_FALLBACK_MODEL}-edit`
        : GPT_IMAGE_FALLBACK_MODEL;
    }
  }

  if (!raw) {
    const imagineWhy = imagine.reject ?? "missed";
    const gptWhy = gpt.reject ?? "missed";
    throw new ImageGenerationFailed(
      `Generation failed. Imagine: ${imagineWhy}. gpt-image-2: ${gptWhy}. A branded gradient is not an ad.`,
    );
  }

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
