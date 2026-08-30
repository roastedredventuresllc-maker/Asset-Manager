import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateImageBuffer } from "./imagePipeline.js";
import {
  ImageGenerationFailed,
  CraftReject,
  GROK_IMAGINE_MODEL,
  GPT_IMAGE_FALLBACK_MODEL,
  rejectIfBakedType,
  rejectIfCheapGrade,
  assertCraftPlate,
} from "./craft.js";
import type { GenerateImageJob } from "./imagePipeline.js";

const here = dirname(fileURLToPath(import.meta.url));

const job: GenerateImageJob = {
  campaignId: "cmp_test",
  adAssetId: "ast_test",
  idx: 0,
  brandName: "Auric",
  ad: {
    hook: "Wake up clearer",
    body: "A nightly ritual.",
    cta: "Get yours",
    angle: "Hero",
    imagePrompt: "soft window light",
    gradientHex1: "#111",
    gradientHex2: "#222",
  },
};

async function noisyPhoto(): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(64 * 80 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
  return sharp(raw, { raw: { width: 64, height: 80, channels: 3 } })
    .png()
    .toBuffer();
}

async function bakedTypePhoto(): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const type = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
      <rect width="400" height="500" fill="#1a1a1a"/>
      <text x="28" y="70" font-size="48" font-family="Arial, Helvetica, sans-serif" fill="#ffffff" font-weight="700">SALE</text>
      <text x="28" y="130" font-size="48" font-family="Arial, Helvetica, sans-serif" fill="#ffffff" font-weight="700">NOW</text>
      <text x="28" y="190" font-size="48" font-family="Arial, Helvetica, sans-serif" fill="#ffffff" font-weight="700">FREE</text>
    </svg>`,
  );
  return sharp(type).png().toBuffer();
}

test("pipeline never calls Gemini", () => {
  const src = readFileSync(join(here, "imagePipeline.ts"), "utf8");
  assert.equal(/gemini-3/.test(src), false);
  assert.equal(/integrations-gemini/.test(src), false);
  assert.equal(/gpt-image-1/.test(src), false);
  assert.match(src, /generateWithImagine/);
  assert.match(src, /generateWithGptImage2/);
  assert.match(src, /GROK_IMAGINE_MODEL/);
  assert.match(src, /GPT_IMAGE_FALLBACK_MODEL/);
  assert.match(src, /imageUrl/);
  assert.match(src, /status: "done"/);
});

test("fail-closed: both models miss → generation failed, never an SVG", async () => {
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithImagine: async () => null,
        generateWithGptImage2: async () => null,
      }),
    (err: unknown) => err instanceof ImageGenerationFailed,
  );
});

test("fail-closed: SVG bytes from a model are rejected", async () => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#123"/></svg>`,
  );
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithImagine: async () => svg,
        generateWithGptImage2: async () => null,
      }),
    (err: unknown) => err instanceof CraftReject || err instanceof ImageGenerationFailed,
  );
});

test("photoreal stub composites 4:5 without shipping a gradient", async () => {
  const photo = await noisyPhoto();
  const { buffer, model } = await generateImageBuffer(job, {
    generateWithImagine: async () => photo,
    generateWithGptImage2: async () => null,
  });
  assert.equal(model, GROK_IMAGINE_MODEL);
  const { default: sharp } = await import("sharp");
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.format, "png");
});

test("baked type on Imagine plate triggers a NEW gpt-image-2 plate, not inpaint", async () => {
  const typed = await bakedTypePhoto();
  const fresh = await noisyPhoto();
  let imagineBuf: Buffer | undefined;
  let gptBuf: Buffer | undefined;
  const { model } = await generateImageBuffer(job, {
    generateWithImagine: async () => typed,
    generateWithGptImage2: async (_prompt, _slot, productPng) => {
      gptBuf = productPng;
      imagineBuf = typed;
      return fresh;
    },
  });
  assert.equal(model, GPT_IMAGE_FALLBACK_MODEL);
  assert.ok(imagineBuf);
  assert.equal(gptBuf, undefined);
});

test("baked type with no fallback fails closed and never composites", async () => {
  const typed = await bakedTypePhoto();
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithImagine: async () => typed,
        generateWithGptImage2: async () => null,
      }),
    (err: unknown) => err instanceof ImageGenerationFailed,
  );
});

test("rejectIfBakedType kills sky type", async () => {
  const typed = await bakedTypePhoto();
  await assert.rejects(
    () => rejectIfBakedType(typed),
    (err: unknown) => err instanceof CraftReject && (err as CraftReject).message.includes("baked_type"),
  );
});

test("rejectIfCheapGrade kills teal-orange cinematic grade", async () => {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(80 * 100 * 3);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 80; x++) {
      const i = (y * 80 + x) * 3;
      if (y < 45) {
        raw[i] = 8;
        raw[i + 1] = 70;
        raw[i + 2] = 80;
      } else {
        raw[i] = 255;
        raw[i + 1] = 170;
        raw[i + 2] = 40;
      }
    }
  }
  const photo = await sharp(raw, { raw: { width: 80, height: 100, channels: 3 } })
    .png()
    .toBuffer();
  await assert.rejects(
    () => rejectIfCheapGrade(photo),
    (err: unknown) => err instanceof CraftReject,
  );
});

test("assertCraftPlate lets a noisy photograph through", async () => {
  await assertCraftPlate(await noisyPhoto());
});
