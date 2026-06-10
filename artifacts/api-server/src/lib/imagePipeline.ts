import { db, adAssetsTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { uploadBuffer } from "./storage.js";
import { compositeAdImage, makeSvgFallback } from "./imageComposite.js";
import type { CampaignAd } from "../ads/types.js";

interface GenerateImageJob {
  campaignId: string;
  adAssetId: string;
  idx: number;
  ad: CampaignAd;
  brandName: string;
  productImageUrl?: string | null;
}

async function fetchProductImage(url: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function callFalAi(
  model: string,
  payload: object,
): Promise<{ images?: Array<{ url: string }>; image?: { url: string } } | null> {
  const key = process.env.FAL_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ model, status: res.status }, "fal.ai request failed");
      return null;
    }
    return res.json();
  } catch (err) {
    logger.warn({ err, model }, "fal.ai fetch error");
    return null;
  }
}

async function generateImageBuffer(
  job: GenerateImageJob,
): Promise<{ buffer: Buffer; model: string }> {
  const { ad, idx, productImageUrl } = job;
  const productBuffer = productImageUrl
    ? await fetchProductImage(productImageUrl)
    : undefined;

  // Ad 0 + 2: 1080x1080. Ad 1: 1080x1920 vertical.
  const width = 1080;
  const height = idx === 1 ? 1920 : 1080;

  // Ad 2: Ideogram for typography accuracy
  if (idx === 2) {
    const res = await callFalAi("fal-ai/ideogram/v3", {
      prompt: `${ad.imagePrompt}. Include the text: "${ad.hook}"`,
      aspect_ratio: "SQUARE",
      style: "DESIGN",
    });
    if (res?.images?.[0]?.url) {
      const imgRes = await fetch(res.images[0].url);
      const rawBuffer = Buffer.from(await imgRes.arrayBuffer());
      const { default: sharp } = await import("sharp");
      const finalBuffer = await sharp(rawBuffer)
        .resize(width, height, { fit: "cover" })
        .composite([
          {
            input: await buildTextOverlay(ad, job.brandName, width, height),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();
      return { buffer: finalBuffer, model: "ideogram-v3" };
    }
  }

  // Ad 0 with product photo: fal.ai image edit (Gemini Nano Banana)
  if (idx === 0 && productBuffer) {
    const base64 = productBuffer.toString("base64");
    const res = await callFalAi("fal-ai/gemini-flash-edit", {
      prompt: ad.imagePrompt,
      image_url: `data:image/jpeg;base64,${base64}`,
    });
    if (res?.images?.[0]?.url || res?.image?.url) {
      const url = (res.images?.[0]?.url ?? res.image?.url)!;
      const imgRes = await fetch(url);
      const rawBuffer = Buffer.from(await imgRes.arrayBuffer());
      const finalBuffer = await compositeAdImage({
        ad,
        brandName: job.brandName,
        sourceImageBuffer: rawBuffer,
        width,
        height,
      });
      return { buffer: finalBuffer, model: "gemini-flash-edit" };
    }
  }

  // FLUX 1.1 Pro text-to-image fallback
  const fluxModel = "fal-ai/flux/pro/v1.1";
  const res = await callFalAi(fluxModel, {
    prompt: ad.imagePrompt,
    image_size: idx === 1 ? "portrait_9_16" : "square_1_1",
    num_images: 1,
    safety_tolerance: "2",
  });

  if (res?.images?.[0]?.url) {
    const imgRes = await fetch(res.images[0].url);
    const rawBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBuffer = await compositeAdImage({
      ad,
      brandName: job.brandName,
      sourceImageBuffer: rawBuffer,
      width,
      height,
    });
    return { buffer: finalBuffer, model: "flux-pro-1.1" };
  }

  // SVG fallback: fal.ai unavailable or all attempts failed
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

async function buildTextOverlay(
  ad: CampaignAd,
  brandName: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const { compositeAdImage: _c, ..._ } = await import("./imageComposite.js");
  const { default: sharp } = await import("sharp");
  // Transparent overlay with just the text/button
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="none"/>
    <text x="${width/2}" y="${height-140}" text-anchor="middle"
      font-family="Georgia,serif" font-size="32" fill="white" font-weight="400">
      ${ad.hook.substring(0, 50)}
    </text>
    <rect x="${width/2-80}" y="${height-100}" width="160" height="44" rx="22" fill="white"/>
    <text x="${width/2}" y="${height-72}" text-anchor="middle"
      font-family="Inter,Arial,sans-serif" font-size="14" fill="#111" font-weight="600">
      ${ad.cta}
    </text>
  </svg>`;
  return Buffer.from(svg);
}

export async function processImageJob(job: GenerateImageJob): Promise<void> {
  logger.info({ adAssetId: job.adAssetId, idx: job.idx }, "Processing image job");

  await db
    .update(adAssetsTable)
    .set({ status: "processing", attempts: db.$count(adAssetsTable) })
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
