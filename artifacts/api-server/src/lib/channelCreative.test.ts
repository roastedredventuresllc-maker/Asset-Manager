import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  adsForPlatform,
  assertAllSlotsAreChannelCreatives,
  assertChannelReadyPng,
  assertRunReadyCreative,
  preferredSlotIndex,
  slotMatchesChannelSpec,
  typeBandRatio,
} from "./channelCreative.js";
import { generateImageBuffer } from "./imagePipeline.js";
import { slotForIndex } from "./craft.js";
import { renderLegalMutePlate } from "./mutePlateFixtures.js";
import type { CampaignAd } from "../ads/types.js";
import type { GenerateImageJob } from "./imagePipeline.js";

const here = dirname(fileURLToPath(import.meta.url));

const ad = (hook: string, cta: string): CampaignAd => ({
  hook,
  body: "A nightly ritual.",
  cta,
  angle: "Hero",
  imagePrompt: "soft window light",
  gradientHex1: "#111",
  gradientHex2: "#222",
});

async function photograph(width: number, height: number): Promise<Buffer> {
  return renderLegalMutePlate({ width, height });
}

test("AD_SLOTS are Meta 4:5 / TikTok 9:16 / Google 4:5 plates", () => {
  assertAllSlotsAreChannelCreatives();
  assert.equal(slotMatchesChannelSpec(slotForIndex(0)), true);
  assert.equal(slotMatchesChannelSpec(slotForIndex(1)), true);
  assert.equal(slotMatchesChannelSpec(slotForIndex(2)), true);
  assert.equal(preferredSlotIndex("tiktok"), 1);
  assert.equal(preferredSlotIndex("meta"), 0);
  assert.equal(preferredSlotIndex("google"), 0);
  assert.equal(typeBandRatio(1080, 1350), 0.32);
  assert.equal(typeBandRatio(1080, 1920), 0.28);
});

test("publish sends TikTok the 9:16 plate and Meta/Google the 4:5 hero", () => {
  const ads = [
    { hook: "Hero line", imageUrl: "https://blob.example/0.png" },
    { hook: "In use", imageUrl: "https://blob.example/1.png" },
    { hook: "Close", imageUrl: "https://blob.example/2.png" },
  ];
  assert.equal(adsForPlatform(ads, "tiktok")[0]?.imageUrl, "https://blob.example/1.png");
  assert.equal(adsForPlatform(ads, "meta")[0]?.imageUrl, "https://blob.example/0.png");
  assert.equal(adsForPlatform(ads, "google")[0]?.imageUrl, "https://blob.example/0.png");
  assert.equal(adsForPlatform(ads, "tiktok").length, 3);
  assert.equal(assertRunReadyCreative(ads, "tiktok")[0]?.imageUrl, "https://blob.example/1.png");
  assert.throws(
    () =>
      assertRunReadyCreative(
        [
          { hook: "Hero line", imageUrl: null },
          { hook: "In use", imageUrl: null },
          { hook: "Close", imageUrl: null },
        ],
        "meta",
      ),
    /Generation failed/,
  );
});

test("all three generated plates are uploadable Meta/TikTok/Google PNGs", async () => {
  for (const idx of [0, 1, 2] as const) {
    const slot = slotForIndex(idx);
    const photo = await photograph(640, 800);
    const job: GenerateImageJob = {
      campaignId: "cmp_channel",
      adAssetId: `ast_${idx}`,
      idx,
      brandName: "Auric",
      ad: ad(idx === 1 ? "Night then quiet" : idx === 2 ? "Hold the glass" : "Wake up clearer", "Get yours"),
    };
    const { buffer } = await generateImageBuffer(job, {
      generateWithImagine: async () => photo,
      generateWithGptImage2: async () => null,
    });
    await assertChannelReadyPng(buffer, slot, job.ad.hook);
  }
});

test("committed family-preview plates are not shipped — empty beige fixtures are a Craft kill", () => {
  const dir = join(here, "../../../launchpad/public/family-preview");
  for (const name of ["hero", "context", "close"] as const) {
    assert.equal(existsSync(join(dir, `${name}.png`)), false);
  }
});

test("generate always opens three stills jobs; a miss is failed not a cream kit", () => {
  const service = readFileSync(join(here, "campaignService.ts"), "utf8");
  assert.match(service, /for \(let idx = 0; idx < 3; idx\+\+\)/);
  assert.match(service, /status: "pending"/);
  const landing = readFileSync(join(here, "landingPage.ts"), "utf8");
  assert.doesNotMatch(landing, /F9F7F4/);
  assert.doesNotMatch(landing, /hv-mark/);
});

test("publish wires adsForPlatform and never assigns ADS_MODE", () => {
  const publish = readFileSync(join(here, "publish.ts"), "utf8");
  assert.match(publish, /assertRunReadyCreative\(adsWithImages, platform\)/);
  assert.equal(/process\.env\.ADS_MODE\s*=/.test(publish), false);
  const pipeline = readFileSync(join(here, "imagePipeline.ts"), "utf8");
  assert.match(pipeline, /compositeAdImage/);
  assert.match(pipeline, /ImageGenerationFailed/);
  assert.doesNotMatch(pipeline, /gemini-3/);
});
