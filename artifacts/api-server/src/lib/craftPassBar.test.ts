import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateImageBuffer } from "./imagePipeline.js";
import { assertChannelReadyPng } from "./channelCreative.js";
import { slotForIndex } from "./craft.js";
import { ImageGenerationFailed } from "./craft.js";
import type { GenerateImageJob } from "./imagePipeline.js";

/**
 * Craft pass bar (CEO). Draft only until Craft GO.
 * Do not merge if any of these six fail.
 */
const here = dirname(fileURLToPath(import.meta.url));
const launchpad = (...p: string[]) => resolve(here, "../../../launchpad", ...p);
const home = readFileSync(launchpad("src/pages/home.tsx"), "utf8");
const board = readFileSync(launchpad("src/components/campaign-board.tsx"), "utf8");
const craft = readFileSync(resolve(here, "craft.ts"), "utf8");
const pipeline = readFileSync(resolve(here, "imagePipeline.ts"), "utf8");
const service = readFileSync(resolve(here, "campaignService.ts"), "utf8");
const landing = readFileSync(resolve(here, "landingPage.ts"), "utf8");
const vercel = JSON.parse(readFileSync(resolve(here, "../../../../vercel.json"), "utf8"));

const job: GenerateImageJob = {
  campaignId: "cmp_passbar",
  adAssetId: "ast_passbar",
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

test("1. Hero / In use / Close are one family on CampaignBoard", () => {
  assert.match(board, /Hero/);
  assert.match(board, /In use/);
  assert.match(board, /Close/);
  assert.match(home, /CampaignFamily/);
  assert.match(board, /data-campaign-family/);
  assert.doesNotMatch(home, /Variant\s*[ABC]/i);
  assert.doesNotMatch(board, /Variant\s*[ABC]/i);
  assert.doesNotMatch(home, /<iframe/);
  assert.doesNotMatch(home, /InSituAd/);
});

test("2. Briefing maps all three stills to imageUrl", () => {
  assert.match(service, /for \(let idx = 0; idx < 3; idx\+\+\)/);
  assert.match(home, /boards=\{\[0, 1, 2\]\.map/);
  assert.match(home, /imageUrl: asset\?\.imageUrl/);
  assert.match(home, /statusRes\.adAssets\?\.find\(\(a\) => a\.idx === idx\)/);
  assert.match(pipeline, /imageUrl,/);
  assert.match(pipeline, /status: "done"/);
});

test("3. Inter type-burn is readable on the generated plate", async () => {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(64 * 80 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
  const photo = await sharp(raw, { raw: { width: 64, height: 80, channels: 3 } })
    .png()
    .toBuffer();
  const { buffer } = await generateImageBuffer(job, {
    generateWithImagine: async () => photo,
    generateWithGptImage2: async () => null,
  });
  await assertChannelReadyPng(buffer, slotForIndex(0), job.ad.hook);
  assert.match(pipeline, /compositeAdImage/);
});

test("4. Mute product: Craft rejects baked letters; type is composited after", () => {
  assert.match(craft, /The model stays MUTE/);
  assert.match(craft, /rejectIfBakedType/);
  assert.match(pipeline, /assertCraftPlate\(raw\)/);
  const acceptThenComposite = pipeline.indexOf("await assertCraftPlate");
  const composite = pipeline.indexOf("await compositeAdImage");
  assert.ok(
    acceptThenComposite > 0 && composite > acceptThenComposite,
    "type is burned only after the mute plate passes Craft",
  );
});

test("5. No cream kit", () => {
  assert.doesNotMatch(landing, /F9F7F4/);
  assert.doesNotMatch(landing, /hv-mark/);
  assert.doesNotMatch(landing, /See how it works/);
  assert.doesNotMatch(landing, /class="halo"/);
  assert.match(landing, /This is not a product page until the stills exist/);
});

test("6. Fail-closed if a still misses", async () => {
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithImagine: async () => null,
        generateWithGptImage2: async () => null,
      }),
    (err: unknown) => err instanceof ImageGenerationFailed,
  );
  assert.match(pipeline, /status: "failed"/);
  assert.match(pipeline, /imageUrl: null/);
  assert.match(board, /Generation failed/);
  assert.match(home, /assetsFailed/);
});

test("out of scope stays locked: ADS_MODE mock, no iframe, no mute-plate /p/ hero work", () => {
  assert.equal(vercel.env?.ADS_MODE, "mock");
  assert.doesNotMatch(home, /<iframe/);
  assert.match(landing, /hero = the plate PNG sharp/);
  assert.doesNotMatch(pipeline, /gemini-3/);
});
