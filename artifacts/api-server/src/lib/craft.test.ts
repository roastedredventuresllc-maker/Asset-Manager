import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AD_SLOTS,
  billboardLine,
  buildCraftPrompt,
  assertCraftPlate,
  fillBleedContextPlate,
  neutralizeContextLift,
  rejectIfNotAPhotograph,
  rejectIfSplitPanel,
  rejectIfUnsafeSafeZone,
  skuLockFromAds,
  slotForIndex,
  CraftReject,
  GROK_IMAGINE_MODEL,
  GPT_IMAGE_FALLBACK_MODEL,
  wordCount,
} from "./craft.js";
import { renderMutePlate } from "./mutePlateFixtures.js";
import type { CampaignAd } from "../ads/types.js";

const ad: CampaignAd = {
  hook: "Wake up clearer than yesterday morning",
  body: "A nightly ritual that actually sticks.",
  cta: "Get yours",
  angle: "Hero",
  imagePrompt: "soft window light on a glass bottle",
  gradientHex1: "#111111",
  gradientHex2: "#222222",
};

test("quality path is Grok Imagine then gpt-image-2, never Gemini", () => {
  assert.equal(GROK_IMAGINE_MODEL, "xai/grok-imagine-image");
  assert.equal(GPT_IMAGE_FALLBACK_MODEL, "gpt-image-2");
});

test("three ads are one campaign: hero, context, tight crop on 4:5 and 9:16", () => {
  assert.equal(AD_SLOTS.length, 3);
  assert.equal(slotForIndex(0).role, "hero");
  assert.equal(slotForIndex(0).aspectRatio, "4:5");
  assert.equal(slotForIndex(0).format, "1080x1350");
  assert.equal(slotForIndex(1).role, "context");
  assert.equal(slotForIndex(1).aspectRatio, "9:16");
  assert.equal(slotForIndex(2).role, "tight_crop");
  assert.equal(slotForIndex(2).aspectRatio, "4:5");
  assert.ok(!AD_SLOTS.some((s) => s.aspectRatio === "1:1"));
});

test("billboard line is 2–6 words", () => {
  const line = billboardLine(ad.hook);
  assert.ok(wordCount(line) >= 2 && wordCount(line) <= 6);
  assert.equal(billboardLine("Stay"), "Stay");
  assert.equal(billboardLine("  One Two Three Four Five Six Seven  "), "One Two Three Four Five Six");
});

test("craft prompt encodes mute model, their product, and campaign coherence", () => {
  const prompt = buildCraftPrompt({
    ad,
    slot: slotForIndex(0),
    brandName: "Auric",
    hasProductPhoto: true,
  });
  assert.match(prompt, /MUTE/i);
  assert.match(prompt, /exact product/i);
  assert.match(prompt, /ONE campaign/i);
  assert.match(prompt, /contact shadow/i);
  assert.match(prompt, /neon void/i);
  assert.match(prompt, /teal-orange/i);
  assert.match(prompt, /window/i);
  assert.match(prompt, /lettermark/i);
  assert.match(prompt, /safe zone/i);
});

test("skuLockFromAds is the hero imagePrompt — Close inherits that SKU", () => {
  assert.equal(
    skuLockFromAds([
      { imagePrompt: "  handled matte carafe, D-handle, integrated spout  " },
      { imagePrompt: "in-use on wood" },
      { imagePrompt: "handle-less pitcher" },
    ]),
    "handled matte carafe, D-handle, integrated spout",
  );
  assert.equal(skuLockFromAds([]), "");
  assert.equal(skuLockFromAds([null, { imagePrompt: "cousin" }]), "");
});

test("context direction forces full-bleed 9:16 of the same open SKU", () => {
  const context = slotForIndex(1);
  assert.match(context.direction, /FULL-BLEED/i);
  assert.match(context.direction, /no cream side panel/i);
  assert.match(context.direction, /no letterbox/i);
  assert.match(context.direction, /not a square inset/i);
  assert.match(context.direction, /open top/i);
  assert.match(context.direction, /no lid/i);
  assert.match(context.direction, /gooseneck kettle/i);
  assert.doesNotMatch(context.direction, /lower-right clear/i);
  assert.match(context.direction, /no blank bottom fifth/i);
});

test("tight crop direction forces the same handled SKU, never a handle-less pitcher", () => {
  const close = slotForIndex(2);
  assert.match(close.direction, /SAME SKU/i);
  assert.match(close.direction, /handle bite/i);
  assert.match(close.direction, /Never invent a handle-less pitcher/i);
  assert.match(close.direction, /NOT a second hero pack-shot/i);
  assert.match(close.direction, /Crop through the body/i);
  assert.match(close.direction, /same mute clay color/i);
});

test("buildCraftPrompt injects hero SKU lock into the close still", () => {
  const heroSku =
    "Hero pack-shot of a handled matte ceramic carafe, D-shaped handle on the right, integrated pouring spout on the left, mute oatmeal clay";
  const prompt = buildCraftPrompt({
    ad: {
      ...ad,
      imagePrompt: "tight crop of the carafe rim",
    },
    slot: slotForIndex(2),
    brandName: "STILLPOUR",
    hasProductPhoto: false,
    skuLock: heroSku,
  });
  assert.match(prompt, /SKU LOCK from the hero still/i);
  assert.match(prompt, /D-shaped handle/);
  assert.match(prompt, /SAME SKU as the hero/i);
  assert.match(prompt, /Never a handle-less pitcher/i);
  assert.match(prompt, /Never a second hero pack-shot/i);
  assert.match(prompt, /same clay color as the hero/i);
  assert.match(prompt, /THREE STILLS, ONE SKU/);
  assert.match(prompt, /handle-less pitcher when the hero has a handle is refuse/i);
  assert.match(prompt, /second full-body hero pack-shot in the tight-crop slot is refuse/i);
});

test("buildCraftPrompt locks in-use as full-bleed of the hero SKU", () => {
  const heroSku =
    "Hero pack-shot of an open-top handled matte carafe, D-shaped handle, integrated spout, no lid";
  const prompt = buildCraftPrompt({
    ad: { ...ad, imagePrompt: "carafe on a kitchen counter" },
    slot: slotForIndex(1),
    brandName: "STILLPOUR",
    hasProductPhoto: false,
    skuLock: heroSku,
  });
  assert.match(prompt, /FULL-BLEED 9:16/i);
  assert.match(prompt, /No cream side panel/i);
  assert.match(prompt, /no lid/i);
  assert.match(prompt, /No gooseneck kettle/i);
  assert.match(prompt, /D-shaped handle/);
  assert.match(prompt, /SKU LOCK from the hero still/i);
  assert.match(prompt, /no blank bottom fifth/i);
});

test("neutralizeContextLift strips a reserved bottom bar from the photographer brief", () => {
  const raw =
    "Full-bleed kitchen, carafe centered mid-frame, bottom fifth kept clear. No kettle.";
  const cleaned = neutralizeContextLift(raw);
  assert.doesNotMatch(cleaned, /bottom fifth kept clear/i);
  assert.doesNotMatch(cleaned, /centered mid-frame/i);
  assert.match(cleaned, /kitchen continues to the bottom edge/i);
  const prompt = buildCraftPrompt({
    ad: { ...ad, imagePrompt: raw },
    slot: slotForIndex(1),
    brandName: "STILLPOUR",
    hasProductPhoto: false,
    skuLock: "open-top handled carafe",
  });
  assert.doesNotMatch(prompt, /bottom fifth kept clear/i);
  assert.match(prompt, /kitchen continues to the bottom edge/i);
});

test("fillBleedContextPlate crops a cream side panel to a 9:16 photograph", async () => {
  const split = await renderMutePlate({ kind: "split_panel", width: 160, height: 280 });
  await assert.rejects(
    () => rejectIfSplitPanel(split),
    (err: unknown) => err instanceof CraftReject && /split_panel/.test((err as Error).message),
  );
  const filled = await fillBleedContextPlate(split, 1080, 1920);
  const { default: sharp } = await import("sharp");
  const meta = await sharp(filled).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1920);
  await rejectIfSplitPanel(filled);
});

test("a lifted SKU is product_in_type_band on In-use; compositor still emits 9:16", async () => {
  const lifted = await renderMutePlate({ kind: "lifted", width: 160, height: 280 });
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(lifted),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(lifted, slotForIndex(1)),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band/.test((err as Error).message),
  );
  const settled = await fillBleedContextPlate(lifted, 1080, 1920);
  const { default: sharp } = await import("sharp");
  const meta = await sharp(settled).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1920);
});

test("full-bleed kitchen window is not a product_in_type_band on In-use", async () => {
  const kitchen = await renderMutePlate({ kind: "kitchen_window", width: 160, height: 280 });
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(kitchen),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band/.test((err as Error).message),
  );
  await rejectIfUnsafeSafeZone(kitchen, slotForIndex(1));
  const filled = await fillBleedContextPlate(kitchen, 1080, 1920);
  await assertCraftPlate(filled, slotForIndex(1));
});

test("type-band-only product stays Craft-closed after the compositor", async () => {
  const band = await renderMutePlate({ kind: "type_band", width: 160, height: 280 });
  const filled = await fillBleedContextPlate(band, 1080, 1920);
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(filled),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band|empty_frame/.test((err as Error).message),
  );
});

test("SVG markup is kill-on-sight", () => {
  assert.throws(
    () => rejectIfNotAPhotograph(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")),
    (err: unknown) => err instanceof CraftReject,
  );
});
