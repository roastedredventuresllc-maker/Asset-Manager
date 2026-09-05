import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateImageBuffer } from "./imagePipeline.js";
import {
  assertAllSlotsAreChannelCreatives,
  assertChannelReadyPng,
  preferredSlotIndex,
} from "./channelCreative.js";
import {
  slotForIndex,
  ImageGenerationFailed,
  CraftReject,
  rejectIfBakedType,
  rejectIfCheapGrade,
  rejectIfUnsafeSafeZone,
  rejectIfSplitPanel,
  assertCraftPlate,
} from "./craft.js";
import { renderLegalMutePlate, renderMutePlate, seedHeroMute } from "./mutePlateFixtures.js";
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
  const photo = await renderLegalMutePlate({ width: 160, height: 200 });
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
  assert.match(craft, /rejectIfUnsafeSafeZone/);
  assert.match(pipeline, /assertCraftPlate\(plate, slot\)/);
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

test("creatives are paid-social run-ready plates, not table-only prints", async () => {
  assertAllSlotsAreChannelCreatives();
  assert.equal(slotForIndex(0).format, "1080x1350");
  assert.equal(slotForIndex(1).format, "1080x1920");
  assert.equal(slotForIndex(2).format, "1080x1350");
  assert.equal(preferredSlotIndex("tiktok"), 1);
  assert.equal(preferredSlotIndex("meta"), 0);
  assert.equal(preferredSlotIndex("google"), 0);
  const publish = readFileSync(resolve(here, "publish.ts"), "utf8");
  assert.match(publish, /assertRunReadyCreative\(adsWithImages, platform\)/);
  const photo = await renderLegalMutePlate({ width: 160, height: 200 });
  await seedHeroMute(job.campaignId);
  for (const idx of [0, 1, 2] as const) {
    const { buffer } = await generateImageBuffer(
      { ...job, idx, adAssetId: `ast_run_${idx}` },
      {
        generateWithImagine: async () => photo,
        generateWithGptImage2: async () => null,
      },
    );
    await assertChannelReadyPng(buffer, slotForIndex(idx), job.ad.hook);
  }
});

test("three stills are one SKU: close inherits the hero imagePrompt", () => {
  assert.match(craft, /export function skuLockFromAds/);
  assert.match(craft, /Never invent a handle-less pitcher/);
  assert.match(craft, /handle bite is required if the hero has a handle/);
  assert.match(craft, /THREE STILLS, ONE SKU/);
  assert.match(craft, /FULL-BLEED photograph of the entire 9:16 plate/);
  assert.match(craft, /gooseneck kettle/);
  assert.match(pipeline, /skuLock: job\.skuLock/);
  assert.match(pipeline, /fillBleedContextPlate/);
  assert.match(pipeline, /0\.mute\.png/);
  assert.match(pipeline, /lockToMute/);
  assert.match(pipeline, /Hero mute missing/);
  assert.match(pipeline, /reencodeToPng\(mute\.buffer\)/);
  assert.match(pipeline, /publicAssetUrl\(`ad-images\/\$\{job\.campaignId\}\/0\.mute\.png`\)/);
  const worker = readFileSync(resolve(here, "worker.ts"), "utf8");
  assert.match(worker, /Holding In-use\/Close until hero mute exists/);
  assert.match(pipeline, /assertCraftPlate\(plate, slot\)/);
  assert.match(craft, /wellSkuStats/);
  assert.match(craft, /slot\?\.role === "context"/);
  const skuLocks = service.match(/skuLock:/g);
  assert.ok(skuLocks && skuLocks.length >= 3, "generate, render-stills, and revise must pass skuLock");
  assert.match(service, /skuLockFromAds/);
});

test("out of scope stays locked: ADS_MODE mock, no iframe, no mute-plate /p/ hero work", () => {
  assert.equal(vercel.env?.ADS_MODE, "mock");
  assert.doesNotMatch(home, /<iframe/);
  assert.match(landing, /hero = the plate PNG sharp/);
  assert.doesNotMatch(pipeline, /gemini-3/);
});

test("kill list never ships: baked type, wrong crop, wet sheen, empty or lettermark", async () => {
  assert.match(craft, /rejectIfBakedType/);
  assert.match(craft, /rejectIfUnsafeSafeZone/);
  assert.match(craft, /wet_plastic_sheen/);
  assert.match(craft, /lettermark/);
  assert.match(craft, /empty_frame/);
  assert.match(craft, /product_in_type_band/);
  assert.match(craft, /product_off_safe_zone/);
  assert.match(craft, /await rejectIfUnsafeSafeZone/);
  assert.match(craft, /rejectIfSplitPanel/);
  assert.match(craft, /split_panel/);
  assert.match(craft, /letterbox/);

  const { default: sharp } = await import("sharp");
  const baked = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
        <rect width="400" height="500" fill="#1a1a1a"/>
        <text x="28" y="70" font-size="48" font-family="Arial" fill="#ffffff" font-weight="700">SALE</text>
        <text x="28" y="130" font-size="48" font-family="Arial" fill="#ffffff" font-weight="700">NOW</text>
        <text x="28" y="190" font-size="48" font-family="Arial" fill="#ffffff" font-weight="700">FREE</text>
      </svg>`,
    ),
  )
    .png()
    .toBuffer();

  const typeBand = await renderMutePlate({ kind: "type_band" });
  const offSafe = await renderMutePlate({ kind: "off_safe" });
  const wet = await renderMutePlate({ kind: "wet_sheen" });
  const empty = await renderMutePlate({ kind: "empty" });
  const lettermark = await renderMutePlate({ kind: "lettermark" });

  await assert.rejects(
    () => rejectIfBakedType(baked),
    (err: unknown) => err instanceof CraftReject && /baked_type/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(typeBand),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(offSafe),
    (err: unknown) => err instanceof CraftReject && /product_off_safe_zone/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfCheapGrade(wet),
    (err: unknown) => err instanceof CraftReject && /wet_plastic_sheen/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(empty),
    (err: unknown) => err instanceof CraftReject && /empty_frame/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(lettermark),
    (err: unknown) => err instanceof CraftReject && /lettermark/.test((err as Error).message),
  );
  const flatWell = await renderMutePlate({ kind: "flat_well" });
  await assertCraftPlate(await renderLegalMutePlate({ width: 160, height: 200 }));
  await assertCraftPlate(await renderMutePlate({ kind: "pale_linen", width: 160, height: 200 }));
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(flatWell),
    (err: unknown) => err instanceof CraftReject && /empty_frame/.test((err as Error).message),
  );
  const split = await renderMutePlate({ kind: "split_panel", width: 160, height: 280 });
  await assert.rejects(
    () => rejectIfSplitPanel(split),
    (err: unknown) => err instanceof CraftReject && /split_panel/.test((err as Error).message),
  );
  await assert.rejects(
    () => assertCraftPlate(split),
    (err: unknown) => err instanceof CraftReject && /split_panel/.test((err as Error).message),
  );
  const letterbox = await renderMutePlate({ kind: "letterbox", width: 160, height: 280 });
  await assert.rejects(
    () => rejectIfSplitPanel(letterbox),
    (err: unknown) => err instanceof CraftReject && /letterbox/.test((err as Error).message),
  );
  await assert.rejects(
    () => assertCraftPlate(letterbox),
    (err: unknown) => err instanceof CraftReject && /letterbox/.test((err as Error).message),
  );
});
