import { test } from "node:test";
import assert from "node:assert/strict";
import { generateImageBuffer } from "./imagePipeline.js";
import { ImageGenerationFailed, CraftReject } from "./craft.js";
import type { GenerateImageJob } from "./imagePipeline.js";

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

test("fail-closed: both models miss → generation failed, never an SVG", async () => {
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithGemini: async () => null,
        generateWithOpenAI: async () => null,
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
        generateWithGemini: async () => svg,
        generateWithOpenAI: async () => null,
      }),
    (err: unknown) => err instanceof CraftReject || err instanceof ImageGenerationFailed,
  );
});

test("photoreal stub composites 4:5 without shipping a gradient", async () => {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(64 * 80 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
  const photo = await sharp(raw, { raw: { width: 64, height: 80, channels: 3 } })
    .png()
    .toBuffer();

  const { buffer, model } = await generateImageBuffer(job, {
    generateWithGemini: async () => photo,
    generateWithOpenAI: async () => null,
  });
  assert.equal(model, "gemini-3-pro-image-preview");
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.format, "png");
});
