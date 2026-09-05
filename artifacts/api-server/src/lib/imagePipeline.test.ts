import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateImageBuffer, imagineAspect } from "./imagePipeline.js";
import {
  ImageGenerationFailed,
  CraftReject,
  GROK_IMAGINE_MODEL,
  GPT_IMAGE_FALLBACK_MODEL,
  rejectIfBakedType,
  rejectIfCheapGrade,
  rejectIfUnsafeSafeZone,
  assertCraftPlate,
  slotForIndex,
} from "./craft.js";
import { toImagineAspect, IMAGINE_ASPECTS } from "@workspace/integrations-xai";
import { renderLegalMutePlate, renderMutePlate, seedHeroMute } from "./mutePlateFixtures.js";
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

async function legalPlate(): Promise<Buffer> {
  return renderLegalMutePlate({ width: 160, height: 200 });
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

test("Imagine never receives 4:5 — hero/tight map to 3:4", () => {
  assert.equal(slotForIndex(0).aspectRatio, "4:5");
  assert.equal(slotForIndex(2).aspectRatio, "4:5");
  assert.equal(imagineAspect(slotForIndex(0)), "3:4");
  assert.equal(imagineAspect(slotForIndex(1)), "9:16");
  assert.equal(imagineAspect(slotForIndex(2)), "3:4");
  assert.equal(toImagineAspect("4:5"), "3:4");
  assert.equal(toImagineAspect("3:4"), "3:4");
  assert.equal(toImagineAspect("9:16"), "9:16");
  assert.equal(toImagineAspect("2:3"), "2:3");
  assert.ok(!(IMAGINE_ASPECTS as readonly string[]).includes("4:5"));
  const pipeline = readFileSync(join(here, "imagePipeline.ts"), "utf8");
  const imagineFn = pipeline.slice(
    pipeline.indexOf("async function defaultImagine"),
    pipeline.indexOf("async function defaultGptImage2"),
  );
  assert.match(imagineFn, /imagineAspect\(slot\)/);
  assert.doesNotMatch(imagineFn, /["']4:5["']/);
  const xaiImage = readFileSync(
    join(here, "../../../../lib/integrations-xai/src/image.ts"),
    "utf8",
  );
  assert.match(xaiImage, /toImagineAspect/);
  assert.match(xaiImage, /aspect_ratio: aspect/);
  assert.doesNotMatch(xaiImage, /aspect_ratio:\s*["']4:5["']/);
});

test("photoreal stub composites 4:5 without shipping a gradient", async () => {
  const photo = await legalPlate();
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
  const fresh = await legalPlate();
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

test("assertCraftPlate lets a legal mute plate through", async () => {
  await assertCraftPlate(await legalPlate());
});

test("kill list fails closed: type band, empty well, lettermark, off-safe crop", async () => {
  const typeBand = await renderMutePlate({ kind: "type_band" });
  const empty = await renderMutePlate({ kind: "empty" });
  const lettermark = await renderMutePlate({ kind: "lettermark" });
  const offSafe = await renderMutePlate({ kind: "off_safe" });
  const wet = await renderMutePlate({ kind: "wet_sheen" });
  const flatWell = await renderMutePlate({ kind: "flat_well" });
  const paleLinen = await renderMutePlate({ kind: "pale_linen" });
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(typeBand),
    (err: unknown) => err instanceof CraftReject && /product_in_type_band/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(empty),
    (err: unknown) => err instanceof CraftReject && /empty_frame/.test((err as Error).message),
  );
  await assert.rejects(
    () => rejectIfUnsafeSafeZone(lettermark),
    (err: unknown) => err instanceof CraftReject && /lettermark/.test((err as Error).message),
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
    () => rejectIfUnsafeSafeZone(flatWell),
    (err: unknown) => err instanceof CraftReject && /empty_frame/.test((err as Error).message),
  );
  await assert.rejects(
    () => assertCraftPlate(empty),
    (err: unknown) => err instanceof CraftReject,
  );
  await assert.rejects(
    () => assertCraftPlate(flatWell),
    (err: unknown) => err instanceof CraftReject && /empty_frame/.test((err as Error).message),
  );
  await assertCraftPlate(paleLinen);
});

test("in-use accepts a full-bleed kitchen with a window in the type band", async () => {
  await seedHeroMute(job.campaignId);
  const kitchen = await renderMutePlate({ kind: "kitchen_window", width: 160, height: 280 });
  const { buffer } = await generateImageBuffer(
    { ...job, idx: 1, adAssetId: "ast_kitchen_window" },
    {
      generateWithImagine: async () => kitchen,
      generateWithGptImage2: async () => null,
    },
  );
  const { default: sharp } = await import("sharp");
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1920);
});

test("in-use compositor fills a split cream panel before Craft", async () => {
  await seedHeroMute(job.campaignId);
  const split = await renderMutePlate({ kind: "split_panel", width: 160, height: 280 });
  const { buffer } = await generateImageBuffer(
    { ...job, idx: 1, adAssetId: "ast_fill_bleed" },
    {
      generateWithImagine: async () => split,
      generateWithGptImage2: async () => null,
    },
  );
  const { default: sharp } = await import("sharp");
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1920);
  const src = readFileSync(join(here, "imagePipeline.ts"), "utf8");
  assert.match(src, /fillBleedContextPlate/);
  assert.match(src, /0\.mute\.png/);
  assert.match(src, /getAsset\(`ad-images\/\$\{job\.campaignId\}\/0\.mute\.png`\)/);
});

test("in-use still prompt is full-bleed of the hero SKU", async () => {
  await seedHeroMute(job.campaignId);
  const photo = await legalPlate();
  let seen = "";
  const heroSku =
    "open-top handled matte carafe with a D-shaped handle and integrated pouring spout, no lid";
  await generateImageBuffer(
    {
      ...job,
      idx: 1,
      adAssetId: "ast_sku_context",
      skuLock: heroSku,
      ad: {
        ...job.ad,
        imagePrompt: "carafe on a kitchen counter, centered mid-frame, bottom fifth kept clear",
      },
    },
    {
      generateWithImagine: async (prompt) => {
        seen = prompt;
        return photo;
      },
      generateWithGptImage2: async () => null,
    },
  );
  assert.match(seen, /FULL-BLEED 9:16/i);
  assert.match(seen, /No cream side panel/i);
  assert.match(seen, /No gooseneck kettle/i);
  assert.match(seen, /OPEN TOP/i);
  assert.match(seen, /no cover, no cap/i);
  assert.match(seen, /FORBIDDEN/i);
  assert.match(seen, /open-top handled matte carafe/);
  assert.doesNotMatch(seen, /bottom fifth kept clear/i);
  assert.match(seen, /kitchen continues to the bottom edge/i);
});

test("in-use without hero mute fails closed instead of inventing a lid", async () => {
  await assert.rejects(
    () =>
      generateImageBuffer(
        { ...job, campaignId: "cmp_no_mute", idx: 1, adAssetId: "ast_no_mute" },
        {
          generateWithImagine: async () => renderMutePlate({ kind: "kitchen_window", width: 160, height: 280 }),
          generateWithGptImage2: async () => null,
        },
      ),
    (err: unknown) =>
      err instanceof ImageGenerationFailed &&
      /Hero mute missing/.test((err as Error).message),
  );
});

test("in-use with hero mute never generates an unreferenced cousin", async () => {
  const mute = await legalPlate();
  const kitchen = await renderMutePlate({
    kind: "kitchen_window",
    width: 160,
    height: 280,
  });
  const campaignId = "cmp_mute_lock";
  const muteDir = join("/tmp/launchpad-assets/ad-images", campaignId);
  mkdirSync(muteDir, { recursive: true });
  writeFileSync(join(muteDir, "0.mute.png"), mute);
  const pngFlags: boolean[] = [];
  try {
    const { model } = await generateImageBuffer(
      { ...job, campaignId, idx: 1, adAssetId: "ast_mute_lock" },
      {
        generateWithImagine: async (_prompt, _slot, productPng) => {
          pngFlags.push(Boolean(productPng));
          return null;
        },
        generateWithGptImage2: async (_prompt, _slot, productPng) => {
          pngFlags.push(Boolean(productPng));
          return kitchen;
        },
      },
    );
    assert.equal(model, `${GPT_IMAGE_FALLBACK_MODEL}-edit`);
    assert.ok(pngFlags.length >= 2);
    assert.ok(
      pngFlags.every((flag) => flag === true),
      "In-use Imagine/gpt calls must all receive the hero mute PNG",
    );
  } finally {
    rmSync(join(muteDir, "0.mute.png"), { force: true });
  }
});

test("in-use mute-edit miss fails closed instead of inventing a lid", async () => {
  const mute = await legalPlate();
  const kitchen = await renderMutePlate({
    kind: "kitchen_window",
    width: 160,
    height: 280,
  });
  const campaignId = "cmp_mute_fail_closed";
  const muteDir = join("/tmp/launchpad-assets/ad-images", campaignId);
  mkdirSync(muteDir, { recursive: true });
  writeFileSync(join(muteDir, "0.mute.png"), mute);
  const pngFlags: boolean[] = [];
  try {
    await assert.rejects(
      () =>
        generateImageBuffer(
          { ...job, campaignId, idx: 1, adAssetId: "ast_mute_fail_closed" },
          {
            generateWithImagine: async (_prompt, _slot, productPng) => {
              pngFlags.push(Boolean(productPng));
              return productPng ? null : kitchen;
            },
            generateWithGptImage2: async (_prompt, _slot, productPng) => {
              pngFlags.push(Boolean(productPng));
              return productPng ? null : kitchen;
            },
          },
        ),
      (err: unknown) => err instanceof ImageGenerationFailed,
    );
    assert.ok(pngFlags.length >= 2);
    assert.ok(
      pngFlags.every((flag) => flag === true),
      "must not fall back to generate without the hero mute",
    );
  } finally {
    rmSync(join(muteDir, "0.mute.png"), { force: true });
  }
});

test("close still prompt carries the hero SKU lock", async () => {
  await seedHeroMute(job.campaignId);
  const photo = await legalPlate();
  let seen = "";
  const heroSku =
    "handled matte ceramic carafe with a D-shaped handle and integrated pouring spout";
  await generateImageBuffer(
    {
      ...job,
      idx: 2,
      adAssetId: "ast_sku_close",
      skuLock: heroSku,
      ad: { ...job.ad, imagePrompt: "tighter crop of the carafe rim" },
    },
    {
      generateWithImagine: async (prompt) => {
        seen = prompt;
        return photo;
      },
      generateWithGptImage2: async () => null,
    },
  );
  assert.match(seen, /SKU LOCK from the hero still/i);
  assert.match(seen, /D-shaped handle/);
  assert.match(seen, /Never a handle-less pitcher/i);
  assert.match(seen, /SAME SKU as the hero/i);
  assert.match(seen, /Never a second hero pack-shot/i);
  assert.match(seen, /same clay color/i);
});

test("lastError names the Craft reject, not only a generic both-missed string", async () => {
  const flat = await renderMutePlate({ kind: "flat_well" });
  await assert.rejects(
    () =>
      generateImageBuffer(job, {
        generateWithImagine: async () => flat,
        generateWithGptImage2: async () => flat,
      }),
    (err: unknown) =>
      err instanceof ImageGenerationFailed &&
      /empty_frame/.test((err as Error).message) &&
      /Imagine:/.test((err as Error).message) &&
      /gpt-image-2:/.test((err as Error).message) &&
      !/both missed or were Craft-rejected/.test((err as Error).message),
  );
});
