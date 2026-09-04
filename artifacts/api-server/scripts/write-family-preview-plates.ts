/**
 * DEV briefing fixtures: three channel-ready plates (Inter type-burn, correct
 * aspects). No Imagine. No Gemini. Run: pnpm exec tsx scripts/write-family-preview-plates.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateImageBuffer } from "../src/lib/imagePipeline.js";
import { slotForIndex } from "../src/lib/craft.js";
import { assertChannelReadyPng } from "../src/lib/channelCreative.js";
import { renderLegalMutePlate } from "../src/lib/mutePlateFixtures.js";
import type { CampaignAd } from "../src/ads/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../launchpad/public/family-preview");

const ads: CampaignAd[] = [
  {
    hook: "Wake up clearer",
    body: "Coffee that waits for you.",
    cta: "Get yours",
    angle: "Hero",
    imagePrompt: "window light",
    gradientHex1: "#111",
    gradientHex2: "#222",
  },
  {
    hook: "Night then quiet",
    body: "At the desk.",
    cta: "Get yours",
    angle: "Context",
    imagePrompt: "desk",
    gradientHex1: "#111",
    gradientHex2: "#222",
  },
  {
    hook: "Hold the glass",
    body: "Closer.",
    cta: "Get yours",
    angle: "Close",
    imagePrompt: "tight",
    gradientHex1: "#111",
    gradientHex2: "#222",
  },
];

async function photograph(width: number, height: number, seed: number): Promise<Buffer> {
  return renderLegalMutePlate({ width, height, seed });
}

const names = ["hero", "context", "close"] as const;

await mkdir(outDir, { recursive: true });
for (let idx = 0; idx < 3; idx++) {
  const slot = slotForIndex(idx);
  const photo = await photograph(640, 800, idx);
  const { buffer } = await generateImageBuffer(
    {
      campaignId: "preview",
      adAssetId: `preview_${idx}`,
      idx,
      brandName: "Stillbrew",
      ad: ads[idx]!,
    },
    {
      generateWithImagine: async () => photo,
      generateWithGptImage2: async () => null,
    },
  );
  await assertChannelReadyPng(buffer, slot, ads[idx]!.hook);
  const file = resolve(outDir, `${names[idx]}.png`);
  await writeFile(file, buffer);
  console.log(file, buffer.length, `${slot.width}x${slot.height}`);
}
