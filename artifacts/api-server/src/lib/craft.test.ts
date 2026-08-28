import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AD_SLOTS,
  billboardLine,
  buildCraftPrompt,
  rejectIfNotAPhotograph,
  slotForIndex,
  CraftReject,
  GROK_IMAGINE_MODEL,
  GPT_IMAGE_FALLBACK_MODEL,
  wordCount,
} from "./craft.js";
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
});

test("SVG markup is kill-on-sight", () => {
  assert.throws(
    () => rejectIfNotAPhotograph(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")),
    (err: unknown) => err instanceof CraftReject,
  );
});
