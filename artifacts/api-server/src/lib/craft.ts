import type { AspectRatio } from "@workspace/integrations-gemini-ai/image";
import type { CampaignAd } from "../ads/types.js";

/** Quality-path model id. Implemented; do not invoke until CEO approves spend. */
export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

export type ShotRole = "hero" | "context" | "tight_crop";

export interface AdSlot {
  idx: number;
  role: ShotRole;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  format: string;
  label: string;
  direction: string;
}

/**
 * Three ads, one campaign. 4:5 feed + 9:16 vertical. Product 40–60% of frame.
 * Type lives in designed negative space (top band) — we composite it.
 */
export const AD_SLOTS: readonly AdSlot[] = [
  {
    idx: 0,
    role: "hero",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    format: "1080x1350",
    label: "Ad 1 — hero (Meta / Instagram / Google Display, 4:5)",
    direction:
      "Hero pack-shot: the product as the only subject, 40–60% of frame, grounded with a real contact shadow, designed empty negative space in the TOP 32% of the frame for typography. Same light family as the other two shots.",
  },
  {
    idx: 1,
    role: "context",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    format: "1080x1920",
    label: "Ad 2 — context (Reels / Stories / TikTok, 9:16)",
    direction:
      "Context shot: the SAME product in a real environment, in-use or in-place. Same light family and color temperature as Ad 1. Product still 40–60% of frame. Empty negative space in the TOP 28% for type. Keep the lower-right clear of the product (platform chrome).",
  },
  {
    idx: 2,
    role: "tight_crop",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    format: "1080x1350",
    label: "Ad 3 — tight crop (Meta / Instagram / Google Display, 4:5)",
    direction:
      "Tight crop of the SAME product, closer, more tactile. Same light family and color temperature as Ad 1. Product 40–60% of frame. Empty negative space in the TOP 32% for type. Not a different board — a closer beat of the same campaign.",
  },
];

export function slotForIndex(idx: number): AdSlot {
  const slot = AD_SLOTS.find((s) => s.idx === idx) ?? AD_SLOTS[0];
  return slot!;
}

/** Billboard line: 2–6 words. Never longer. */
export function billboardLine(hook: string): string {
  const words = hook
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const kept = words.slice(0, 6);
  if (kept.length === 1) return kept[0]!;
  return kept.join(" ");
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const CRAFT_HARD_NOS = `
HARD NOS — if you would violate any of these, refuse the image rather than guess:
- THIS is the founder's actual product. Do not invent a SKU, extra pump, extra bottle, extra lid, extra label, or melted/morphed logo. If the reference photo is provided, the product in the scene must be that product — same silhouette, color, materials, label.
- No AI-cheap light: no neon void, no plastic sheen, no floating product, no missing contact shadow. The product sits on a real surface with a real contact shadow. Light is photographic (window, studio softbox, overcast daylight) — not a glow.
- The model stays MUTE. Absolutely no text, no words, no letters, no numbers, no logos, no watermarks, no packaging claims rendered as type. Typography is composited later in designed negative space.
- Product occupies 40–60% of the frame — not a tiny floating trinket, not a full-bleed crop that leaves no room for type.
- Leave designed empty negative space in the TOP of the frame (about the top third) with no product, no busy texture, no faces. That band is for type we add ourselves. Never place the product in that top band.
`.trim();

const PHOTO_STYLE =
  " Photoreal advertising photography, shot on a real camera, sharp focus, high detail, premium commercial campaign quality, natural color, believable materials.";

export function buildCraftPrompt(opts: {
  ad: CampaignAd;
  slot: AdSlot;
  brandName: string;
  hasProductPhoto: boolean;
}): string {
  const { ad, slot, brandName, hasProductPhoto } = opts;
  const productClause = hasProductPhoto
    ? `The attached image IS the product. Place THIS exact product in the scene. Do not substitute, restyle, or invent a different one.`
    : `Photograph a photoreal product that matches the brief. Do not invent extra parts.`;

  const shot =
    slot.role === "hero"
      ? "HERO: single product, centered-low, grounded, iconic."
      : slot.role === "context"
        ? "CONTEXT: same product in a real place, in-use or in-habitat. Same campaign, not a new board."
        : "TIGHT CROP: same product, closer, tactile, same campaign light. Not a new board.";

  return [
    `Campaign for ${brandName}. Three ads, ONE campaign — same light family, same color temperature, same product.`,
    shot,
    slot.direction,
    productClause,
    `Photographer's brief: ${ad.imagePrompt}`,
    CRAFT_HARD_NOS,
    PHOTO_STYLE,
  ].join(" ");
}

export class ImageGenerationFailed extends Error {
  readonly code = "generation_failed";
  constructor(message = "Generation failed") {
    super(message);
    this.name = "ImageGenerationFailed";
  }
}

export class CraftReject extends Error {
  readonly code = "craft_reject";
  constructor(reason: string) {
    super(`Craft reject: ${reason}`);
    this.name = "CraftReject";
  }
}

/** Local kill-on-sight: SVG markup or a flat gradient is not an ad. */
export function rejectIfNotAPhotograph(buffer: Buffer): void {
  const head = buffer.subarray(0, 256).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    throw new CraftReject("svg_gradient");
  }
  if (buffer.length < 8) {
    throw new CraftReject("empty");
  }
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isJpeg && !isPng && !isWebp) {
    throw new CraftReject("not_a_photograph");
  }
}

export async function rejectIfFlatGradient(buffer: Buffer): Promise<void> {
  const { default: sharp } = await import("sharp");
  const stats = await sharp(buffer).stats();
  const stdevs = stats.channels.map((c) => c.stdev);
  const meanStd = stdevs.reduce((a, b) => a + b, 0) / Math.max(stdevs.length, 1);
  // A branded gradient has almost no spatial variance. A photograph does.
  if (meanStd < 8) {
    throw new CraftReject("flat_gradient");
  }
}
