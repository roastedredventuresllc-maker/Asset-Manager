/**
 * Prove the Craft image path with files, not typecheck.
 *
 * Writes under /opt/cursor/artifacts:
 * - jpeg_upload_as_stored.jpg          (uploads.ts shape)
 * - jpeg_reencoded_to_png_for_edit.png (edit MIME matches bytes)
 * - kill_on_sight_svg_gradient.png     (the thing we refuse)
 * - campaign_ad_{hero,context,tight_crop}_*.png
 *
 * Live models: gpt-image-1 if OPENAI_API_KEY is set. Never calls
 * gemini-3-pro-image-preview in this run (CEO spend freeze).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { detectImageMime, reencodeToPng, EDIT_MIME } from "../src/lib/imageMime.js";
import { generateImageBuffer } from "../src/lib/imagePipeline.js";
import { makeSvgFallbackKillOnSight } from "../src/lib/imageComposite.js";
import { ImageGenerationFailed, slotForIndex } from "../src/lib/craft.js";
import { isGeminiImageConfigured } from "@workspace/integrations-gemini-ai/image";
import { isOpenAIImageConfigured } from "@workspace/integrations-openai-ai-server/image";

const OUT = process.env.PROVE_OUT ?? "/opt/cursor/artifacts";

const PRODUCT_URLS = [
  // Public product photograph (skincare jar). Used only when live models are unset.
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1080&q=80",
  "https://picsum.photos/800/1000.jpg",
  "https://httpbin.org/image/jpeg",
];

const ads = [
  {
    hook: "Wake up clearer",
    body: "A nightly ritual for the morning after.",
    cta: "Get yours",
    angle: "Hero",
    imagePrompt: "soft north window light, marble ledge, contact shadow",
    gradientHex1: "#1a1a2e",
    gradientHex2: "#16213e",
  },
  {
    hook: "Night, then quiet",
    body: "The same bottle, on the bedside, evening lamp.",
    cta: "Shop now",
    angle: "Context",
    imagePrompt: "bedside table, warm lamp, same bottle",
    gradientHex1: "#1a1a2e",
    gradientHex2: "#16213e",
  },
  {
    hook: "Hold the glass",
    body: "Closer. Same light. Same campaign.",
    cta: "See it",
    angle: "Tight crop",
    imagePrompt: "tight crop of glass and label, same window light",
    gradientHex1: "#1a1a2e",
    gradientHex2: "#16213e",
  },
] as const;

async function frameProductInLowerBand(png: Buffer, width: number, height: number): Promise<Buffer> {
  const band = Math.round(height * 0.32);
  const productH = height - band;
  const product = await sharp(png)
    .resize({ width, height: productH, fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  return sharp({
    create: { width, height, channels: 3, background: { r: 244, g: 244, b: 246 } },
  })
    .composite([{ input: product, top: band, left: 0 }])
    .png()
    .toBuffer();
}

async function fetchPhotograph(): Promise<Buffer> {
  for (const url of PRODUCT_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LaunchPadCraftProof/1.0 (image pipeline verification)" },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (detectImageMime(buf)) return buf;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "Could not fetch a product photograph to prove the pipeline. Network/egress may block Wikimedia.",
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("gemini configured (off-Replit path):", isGeminiImageConfigured());
  console.log("openai configured:", isOpenAIImageConfigured());
  console.log("edit MIME:", EDIT_MIME);

  // 1. JPEG/PNG trap — same as uploads.ts (store JPEG) then pipeline re-encode.
  const photo = await fetchPhotograph();
  const jpegUpload = await sharp(photo)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (detectImageMime(jpegUpload) !== "image/jpeg") {
    throw new Error("upload path did not produce JPEG");
  }
  if (!existsSync(join(OUT, "jpeg_upload_as_stored.jpg"))) {
    await writeFile(join(OUT, "jpeg_upload_as_stored.jpg"), jpegUpload);
  }
  const pngForEdit = await reencodeToPng(jpegUpload);
  if (detectImageMime(pngForEdit) !== "image/png") {
    throw new Error("re-encode did not produce PNG");
  }
  if (!existsSync(join(OUT, "jpeg_reencoded_to_png_for_edit.png"))) {
    await writeFile(join(OUT, "jpeg_reencoded_to_png_for_edit.png"), pngForEdit);
  }

  const kill = await makeSvgFallbackKillOnSight({
    ad: ads[0],
    brandName: "Auric",
    width: 540,
    height: 675,
  });
  if (!existsSync(join(OUT, "kill_on_sight_svg_gradient.png"))) {
    await writeFile(join(OUT, "kill_on_sight_svg_gradient.png"), kill);
  }

  // 3. Fail-closed: both models miss → no SVG file written as an ad.
  let failedClosed = false;
  try {
    await generateImageBuffer(
      {
        campaignId: "cmp_prove",
        adAssetId: "ast_prove",
        idx: 0,
        brandName: "Auric",
        ad: ads[0],
      },
      {
        generateWithGemini: async () => null,
        generateWithOpenAI: async () => null,
      },
    );
  } catch (err) {
    failedClosed = err instanceof ImageGenerationFailed;
  }
  if (!failedClosed) throw new Error("expected ImageGenerationFailed when both models miss");

  // 4. Three-slot campaign through the real compositor + reject rules.
  //    Prefer gpt-image-1 when OPENAI_API_KEY is present. Never call
  //    gemini-3-pro-image-preview here (CEO spend freeze).
  const useLiveOpenAI = isOpenAIImageConfigured();
  for (const idx of [0, 1, 2] as const) {
    const slot = slotForIndex(idx);
    const job = {
      campaignId: "cmp_prove",
      adAssetId: `ast_prove_${idx}`,
      idx,
      brandName: "Auric",
      ad: ads[idx],
      productImageUrl: undefined as string | undefined,
    };

    let source: Buffer;
    let model: string;
    if (useLiveOpenAI) {
      const openai = await import("@workspace/integrations-openai-ai-server/image");
      const generated = await openai.generateImageBuffer(
        `Photoreal advertising photograph, no text, no letters. ${ads[idx].imagePrompt}. Product occupies 40-60% of frame, empty top third, contact shadow.`,
        slot.aspectRatio === "9:16" ? "1024x1536" : "1024x1536",
      );
      const result = await generateImageBuffer(job, {
        generateWithGemini: async () => null,
        generateWithOpenAI: async () => generated,
      });
      source = result.buffer;
      model = result.model;
    } else {
      // Photograph path (live models unset): JPEG→PNG product photo, framed
      // with empty top third, then the real compositor. Not a Gemini call.
      const framed = await frameProductInLowerBand(pngForEdit, slot.width, slot.height);
      const result = await generateImageBuffer(job, {
        generateWithGemini: async () => framed,
        generateWithOpenAI: async () => null,
      });
      source = result.buffer;
      model = "photograph_composite_not_a_model_call";
    }

    const name =
      slot.role === "hero"
        ? "campaign_slot_hero_4x5.png"
        : slot.role === "context"
          ? "campaign_slot_context_9x16.png"
          : "campaign_slot_tight_crop_4x5.png";
    await writeFile(join(OUT, name), source);
    const meta = await sharp(source).metadata();
    console.log(name, { width: meta.width, height: meta.height, format: meta.format, model });
  }

  await writeFile(
    join(OUT, "image_pipeline_proof_framed.json"),
    JSON.stringify(
      {
        geminiImageModel: "gemini-3-pro-image-preview",
        geminiConfigured: isGeminiImageConfigured(),
        openaiConfigured: isOpenAIImageConfigured(),
        invokedGemini3ProImagePreview: false,
        usedGptImage1: useLiveOpenAI,
        editMime: EDIT_MIME,
        jpegUploadMagic: detectImageMime(jpegUpload),
        pngEditMagic: detectImageMime(pngForEdit),
        failClosedWhenBothMiss: failedClosed,
        adsMode: process.env.ADS_MODE ?? "mock",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
