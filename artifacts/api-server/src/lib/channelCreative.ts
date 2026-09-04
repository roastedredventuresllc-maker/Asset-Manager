import type { CampaignAd } from "../ads/types.js";
import { AD_SLOTS, slotForIndex, type AdSlot } from "./craft.js";
import { assertCompositedTypeIsReadable } from "./typeInk.js";
import { loadSharp } from "./loadSharp.js";

export type PaidSocialPlatform = "meta" | "tiktok" | "google";

/**
 * Paid-social upload specs. These plates are the creatives — not table mockups.
 * Meta feed + Google Display: 4:5 1080×1350. TikTok / Reels / Stories: 9:16 1080×1920.
 */
export const CHANNEL_CREATIVE_SPEC = {
  hero: {
    idx: 0,
    platforms: ["meta", "google"] as const,
    width: 1080,
    height: 1350,
    mime: "image/png",
    maxBytes: 8 * 1024 * 1024,
  },
  context: {
    idx: 1,
    platforms: ["tiktok", "meta"] as const,
    width: 1080,
    height: 1920,
    mime: "image/png",
    maxBytes: 8 * 1024 * 1024,
  },
  tight_crop: {
    idx: 2,
    platforms: ["meta", "google"] as const,
    width: 1080,
    height: 1350,
    mime: "image/png",
    maxBytes: 8 * 1024 * 1024,
  },
} as const;

/** Type band on the plate. Context (9:16) is 28%; hero/close (4:5) are 32%. */
export function typeBandRatio(width: number, height: number): number {
  return height / width >= 1.7 ? 0.28 : 0.32;
}

export function slotMatchesChannelSpec(slot: AdSlot): boolean {
  const spec =
    slot.role === "hero"
      ? CHANNEL_CREATIVE_SPEC.hero
      : slot.role === "context"
        ? CHANNEL_CREATIVE_SPEC.context
        : CHANNEL_CREATIVE_SPEC.tight_crop;
  return slot.width === spec.width && slot.height === spec.height && slot.idx === spec.idx;
}

/** TikTok needs the 9:16 plate. Meta/Google take the 4:5 hero (tight crop is the pair). */
export function preferredSlotIndex(platform: PaidSocialPlatform): number {
  return platform === "tiktok" ? 1 : 0;
}

export function adsForPlatform<T extends CampaignAd>(
  ads: T[],
  platform: PaidSocialPlatform,
): T[] {
  const preferred = preferredSlotIndex(platform);
  if (preferred === 0 || ads.length < 2) return ads;
  const head = ads[preferred];
  if (!head) return ads;
  return [head, ...ads.filter((_, i) => i !== preferred)];
}

export async function assertChannelReadyPng(
  buffer: Buffer,
  slot: AdSlot,
  hook: string,
): Promise<void> {
  if (!slotMatchesChannelSpec(slot)) {
    throw new Error(`slot ${slot.idx} ${slot.role} is not a paid-social creative spec`);
  }
  const pngMagic = buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  if (!pngMagic) {
    throw new Error(`slot ${slot.idx} is not a PNG — not uploadable to Meta/TikTok/Google`);
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error(`slot ${slot.idx} exceeds 8MB platform image cap`);
  }
  const sharp = await loadSharp();
  const meta = await sharp(buffer).metadata();
  if (meta.format !== "png") {
    throw new Error(`slot ${slot.idx} format ${meta.format} is not png`);
  }
  if (meta.width !== slot.width || meta.height !== slot.height) {
    throw new Error(
      `slot ${slot.idx} is ${meta.width}x${meta.height}, want ${slot.width}x${slot.height}`,
    );
  }
  await assertCompositedTypeIsReadable(buffer, hook, typeBandRatio(slot.width, slot.height));
}

export function assertAllSlotsAreChannelCreatives(): void {
  for (const slot of AD_SLOTS) {
    if (!slotMatchesChannelSpec(slot)) {
      throw new Error(`AD_SLOTS[${slot.idx}] drifted off the Meta/TikTok/Google plate spec`);
    }
  }
  if (slotForIndex(0).format !== "1080x1350") throw new Error("hero format");
  if (slotForIndex(1).format !== "1080x1920") throw new Error("context format");
  if (slotForIndex(2).format !== "1080x1350") throw new Error("close format");
}
