import type { CampaignAd } from "../ads/types.js";
import { loadSharp } from "./loadSharp.js";

/** Primary stills model — Grok Imagine via AI Gateway (current GA id). */
export const GROK_IMAGINE_MODEL = "xai/grok-imagine-image";
/** Fallback stills model. Never gpt-image-1. Never Gemini. */
export const GPT_IMAGE_FALLBACK_MODEL = "gpt-image-2";

export type AspectRatio = "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "4:5";

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
- No AI-cheap light: no neon void, no plastic sheen, no floating product, no missing contact shadow. The product sits on a real surface with a real contact shadow. Light is ONE window (north window / overcast daylight / simple studio window) — not a glow, not cinematic bloom, not teal-orange grade.
- Wet plastic sheen, over-smooth CGI product, teal-and-orange cinematic grade, and bloomed highlights are refuse. Real material, one window, honest texture.
- The model stays MUTE. Absolutely no text, no words, no letters, no numbers, no logos, no watermarks, no packaging claims rendered as type. No fake label type. No sky type. No garbled letters. Typography is composited later in designed negative space. If the product has letters on it, photograph it MUTE — blank the type rather than invent glyphs.
- Product occupies 40–60% of the frame — not a tiny floating trinket, not a lettermark, not an empty well, not a full-bleed crop that leaves no room for type.
- Leave designed empty negative space in the TOP of the frame (about the top third) with no product, no busy texture, no faces. That band is for type we add ourselves. Never place the product in that top band.
- Paid-social safe zone: keep the product inside the frame, out of the top type band and out of the outer 12% gutters. A plate that would crop the product off the 4:5 or 9:16 safe zone is refuse.
`.trim();

const PHOTO_STYLE =
  " Photoreal advertising photography, shot on a real camera, sharp focus, high detail, premium commercial campaign quality, natural color, believable materials, one window light.";

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
  const sharp = await loadSharp();
  const stats = await sharp(buffer).stats();
  const stdevs = stats.channels.map((c) => c.stdev);
  const meanStd = stdevs.reduce((a, b) => a + b, 0) / Math.max(stdevs.length, 1);
  // A branded gradient has almost no spatial variance. A photograph does.
  if (meanStd < 8) {
    throw new CraftReject("flat_gradient");
  }
}

type GlyphBox = { minx: number; miny: number; maxx: number; maxy: number; area: number };

/**
 * Any letter in the plate is reject: fake label, sky type, garbled, baked headline.
 * Do not crop it. Do not composite type over it.
 */
export async function rejectIfBakedType(buffer: Buffer): Promise<void> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(buffer)
    .resize({ width: 280, height: 360, fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const binary = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = data[i]!;
      const n =
        (data[i - 1]! + data[i + 1]! + data[i - w]! + data[i + w]!) / 4;
      binary[i] = Math.abs(c - n) > 26 ? 1 : 0;
    }
  }

  const seen = new Uint8Array(w * h);
  const glyphs: GlyphBox[] = [];
  const stack: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    if (!binary[i] || seen[i]) continue;
    stack.push(i);
    seen[i] = 1;
    let minx = w;
    let miny = h;
    let maxx = 0;
    let maxy = 0;
    let area = 0;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p / w) | 0;
      area++;
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
      const neighbors = [p - 1, p + 1, p - w, p + w];
      for (const n of neighbors) {
        if (n < 0 || n >= binary.length || seen[n] || !binary[n]) continue;
        const nx = n % w;
        const ny = (n / w) | 0;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const gw = maxx - minx + 1;
    const gh = maxy - miny + 1;
    const aspect = gw / Math.max(gh, 1);
    const tall = gh / h;
    if (area < 12 || area > (w * h) / 12) continue;
    if (tall < 0.035 || tall > 0.28) continue;
    if (aspect < 0.12 || aspect > 1.7) continue;
    glyphs.push({ minx, miny, maxx, maxy, area });
  }

  const rows = new Map<number, GlyphBox[]>();
  for (const g of glyphs) {
    const cy = Math.round(((g.miny + g.maxy) / 2 / h) * 18);
    const list = rows.get(cy) ?? [];
    list.push(g);
    rows.set(cy, list);
  }
  for (const list of rows.values()) {
    if (list.length >= 3) {
      throw new CraftReject("baked_type");
    }
  }
}

function hueDeg(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 8) return -1;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

/**
 * Wet plastic sheen, over-smooth product, teal-orange grade, cinematic bloom.
 * One window light, real material.
 */
export async function rejectIfCheapGrade(buffer: Buffer): Promise<void> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(buffer)
    .resize({ width: 240, height: 300, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  const ch = info.channels;

  let darkTeal = 0;
  let darkN = 0;
  let brightOrange = 0;
  let brightN = 0;
  let clip = 0;
  let bloom = 0;

  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * ch]!;
    const g = data[i * ch + 1]!;
    const b = data[i * ch + 2]!;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = y;
    const hdeg = hueDeg(r, g, b);
    if (y < 90) {
      darkN++;
      if (hdeg >= 150 && hdeg <= 200) darkTeal++;
    }
    if (y > 175) {
      brightN++;
      if (hdeg >= 15 && hdeg <= 50) brightOrange++;
    }
    if (y > 248) clip++;
  }

  const tealRatio = darkN ? darkTeal / darkN : 0;
  const orangeRatio = brightN ? brightOrange / brightN : 0;
  if (tealRatio > 0.28 && orangeRatio > 0.28) {
    throw new CraftReject("teal_orange_grade");
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (luma[i]! < 248) continue;
      let halo = 0;
      const ring = [i - 1, i + 1, i - w, i + w];
      for (const p of ring) {
        const v = luma[p]!;
        if (v > 170 && v < 245) halo++;
      }
      if (halo >= 3) bloom++;
    }
  }
  if (clip / n > 0.12 && bloom / n > 0.04) {
    throw new CraftReject("cinematic_bloom");
  }

  let brightLap = 0;
  let brightLapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (luma[i]! < 200) continue;
      const ring = [luma[i - 1]!, luma[i + 1]!, luma[i - w]!, luma[i + w]!];
      if (ring.some((v) => v < 180)) continue;
      const v = Math.abs(4 * luma[i]! - ring[0]! - ring[1]! - ring[2]! - ring[3]!);
      brightLap += v;
      brightLapN++;
    }
  }
  const meanBrightLap = brightLap / Math.max(brightLapN, 1);
  const specular = clip / n;
  if (specular > 0.08 && brightLapN > 20 && meanBrightLap < 6) {
    throw new CraftReject("wet_plastic_sheen");
  }
}

/**
 * Paid-social safe zone on the MUTE plate (before Inter is composited).
 * Subject ≠ pale linen / oatmeal. A flat beige sticker is an empty well.
 * Product sits in the well, not a lettermark, not in the 12% gutters.
 */
export const SAFE_ZONE = {
  typeBand: 0.32,
  insetX: 0.12,
  wellY0: 0.42,
  wellY1: 0.88,
  maxTypeBandBusy: 0.12,
  minWellOccupancy: 0.08,
  lettermarkOccupancy: 0.025,
  fieldDelta: 36,
  flatInteriorStdev: 5.5,
  flatInteriorGrad: 6,
} as const;

function lumaOf(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDist(
  r: number,
  g: number,
  b: number,
  fr: number,
  fg: number,
  fb: number,
): number {
  return Math.hypot(r - fr, g - fg, b - fb);
}

function channelMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export async function rejectIfUnsafeSafeZone(buffer: Buffer): Promise<void> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(buffer)
    .resize({ width: 240, height: 320, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const at = (x: number, y: number) => {
    const i = (y * w + x) * ch;
    return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
  };
  const luma = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y);
      luma[y * w + x] = lumaOf(r, g, b);
    }
  }
  const gradAt = (x: number, y: number): number => {
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return 0;
    const gx = luma[y * w + x + 1]! - luma[y * w + x - 1]!;
    const gy = luma[(y + 1) * w + x]! - luma[(y - 1) * w + x]!;
    return Math.hypot(gx, gy);
  };

  const bandH = Math.round(h * SAFE_ZONE.typeBand);
  const bandPad = Math.max(1, Math.round(w * 0.04));
  const fieldR: number[] = [];
  const fieldG: number[] = [];
  const fieldB: number[] = [];
  for (let y = 0; y < bandH; y++) {
    for (let x = bandPad; x < w - bandPad; x++) {
      const [r, g, b] = at(x, y);
      fieldR.push(r);
      fieldG.push(g);
      fieldB.push(b);
    }
  }
  const fr = channelMedian(fieldR);
  const fg = channelMedian(fieldG);
  const fb = channelMedian(fieldB);
  const isSubject = (x: number, y: number): boolean => {
    const [r, g, b] = at(x, y);
    return colorDist(r, g, b, fr, fg, fb) > SAFE_ZONE.fieldDelta;
  };

  let bandBusy = 0;
  let bandN = 0;
  for (let y = 0; y < bandH; y++) {
    for (let x = bandPad; x < w - bandPad; x++) {
      bandN++;
      if (isSubject(x, y)) bandBusy++;
    }
  }
  if (bandN > 0 && bandBusy / bandN > SAFE_ZONE.maxTypeBandBusy) {
    throw new CraftReject("product_in_type_band");
  }

  const x0 = Math.round(w * SAFE_ZONE.insetX);
  const x1 = Math.round(w * (1 - SAFE_ZONE.insetX));
  const y0 = Math.round(h * SAFE_ZONE.wellY0);
  const y1 = Math.round(h * SAFE_ZONE.wellY1);
  let wellProduct = 0;
  let wellN = 0;
  let intN = 0;
  let intSum = 0;
  let intSum2 = 0;
  let intGrad = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      wellN++;
      if (!isSubject(x, y)) continue;
      wellProduct++;
      const interior =
        isSubject(x - 1, y) &&
        isSubject(x + 1, y) &&
        isSubject(x, y - 1) &&
        isSubject(x, y + 1);
      if (!interior) continue;
      const L = luma[y * w + x]!;
      intN++;
      intSum += L;
      intSum2 += L * L;
      intGrad += gradAt(x, y);
    }
  }
  const wellOcc = wellProduct / Math.max(wellN, 1);
  const intMean = intSum / Math.max(intN, 1);
  const intStdev = Math.sqrt(Math.max(0, intSum2 / Math.max(intN, 1) - intMean * intMean));
  const intMeanGrad = intGrad / Math.max(intN, 1);

  let gutterProduct = 0;
  let gutterN = 0;
  let bottomProduct = 0;
  let bottomN = 0;
  const yBottom = Math.round(h * 0.9);
  for (let y = y0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hit = isSubject(x, y);
      if (y >= yBottom) {
        bottomN++;
        if (hit) bottomProduct++;
      }
      if (y < y1 && (x < x0 || x >= x1)) {
        gutterN++;
        if (hit) gutterProduct++;
      }
    }
  }
  const gutterRatio = gutterProduct / Math.max(gutterN, 1);
  const bottomRatio = bottomProduct / Math.max(bottomN, 1);

  if (wellOcc >= SAFE_ZONE.minWellOccupancy) {
    if (
      intN > 20 &&
      intStdev < SAFE_ZONE.flatInteriorStdev &&
      intMeanGrad < SAFE_ZONE.flatInteriorGrad
    ) {
      throw new CraftReject("empty_frame");
    }
    return;
  }

  if (gutterRatio > 0.04 || bottomRatio > 0.08) {
    throw new CraftReject("product_off_safe_zone");
  }
  if (wellOcc >= SAFE_ZONE.lettermarkOccupancy) {
    throw new CraftReject("lettermark");
  }
  throw new CraftReject("empty_frame");
}

/** Run every Craft lock check. Composite type only after this passes. */
export async function assertCraftPlate(buffer: Buffer): Promise<void> {
  rejectIfNotAPhotograph(buffer);
  await rejectIfFlatGradient(buffer);
  await rejectIfBakedType(buffer);
  await rejectIfCheapGrade(buffer);
  await rejectIfUnsafeSafeZone(buffer);
}
