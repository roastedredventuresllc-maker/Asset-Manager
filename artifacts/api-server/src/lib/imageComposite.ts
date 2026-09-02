import type { CampaignAd } from "../ads/types.js";
import { billboardLine } from "./craft.js";
import { loadSharp } from "./loadSharp.js";
import {
  COMPOSITE_FONT_FAMILY,
  compositeFontFaceCss,
  ensureCompositeFontconfig,
} from "./loadCompositeFonts.js";

export interface CompositeOptions {
  ad: CampaignAd;
  brandName: string;
  sourceImageBuffer: Buffer;
  width: number;
  height: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function ctaPillSvg(cx: number, rectTopY: number, rawText: string, fontSize = 15): string {
  const display = truncate(rawText, 26);
  const charW = fontSize * 0.62;
  const padX = 30;
  const pillW = Math.max(150, Math.ceil(display.length * charW) + padX * 2);
  const pillH = Math.round(fontSize * 3);
  const x = cx - pillW / 2;
  const textY = rectTopY + Math.round(pillH / 2) + Math.round(fontSize * 0.35);
  return `<rect x="${x}" y="${rectTopY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="white"/>
  <text x="${cx}" y="${textY}" text-anchor="middle" font-family="${COMPOSITE_FONT_FAMILY}" font-size="${fontSize}" fill="#111111" font-weight="700">${escapeXml(display)}</text>`;
}

/**
 * Composite a 2–6 word billboard into designed TOP negative space.
 * Never draws type over the lower ~68% of the frame (the product lives there).
 * Type is Inter Regular + Bold from vendored TTFs — never a system serif or CDN.
 */
export async function compositeAdImage(opts: CompositeOptions): Promise<Buffer> {
  const sharp = await loadSharp();
  ensureCompositeFontconfig();
  const { ad, brandName, sourceImageBuffer, width, height } = opts;

  if (!sourceImageBuffer || sourceImageBuffer.length === 0) {
    throw new Error("compositeAdImage requires a photograph — a branded gradient is not an ad");
  }

  const line = billboardLine(ad.hook);
  const bandH = Math.round(height * 0.32);
  const hookSize = width > 1000 ? 42 : 32;
  const cx = width / 2;
  const brandY = Math.round(bandH * 0.38);
  const hookY = Math.round(bandH * 0.58);
  const ctaY = Math.round(bandH * 0.68);

  const svgOverlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <style type="text/css">${compositeFontFaceCss()}</style>
    <linearGradient id="neg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${bandH}" fill="url(#neg)"/>
  <text x="${cx}" y="${brandY}" text-anchor="middle"
    font-family="${COMPOSITE_FONT_FAMILY}" font-size="13" fill="rgba(255,255,255,0.75)"
    letter-spacing="3" font-weight="400">
    ${escapeXml(brandName.toUpperCase())}
  </text>
  <text x="${cx}" y="${hookY}" text-anchor="middle"
    font-family="${COMPOSITE_FONT_FAMILY}" font-size="${hookSize}" fill="white" font-weight="400">
    ${escapeXml(line)}
  </text>
  ${ctaPillSvg(cx, ctaY, ad.cta, 14)}
</svg>`;

  return sharp(sourceImageBuffer)
    .resize(width, height, { fit: "cover", position: "center" })
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * KILL-ON-SIGHT sample. A branded gradient is not an ad.
 * Never used as campaign output. Kept so Craft can point at the thing we refuse.
 */
export async function makeSvgFallbackKillOnSight(opts: {
  ad: CampaignAd;
  brandName: string;
  width: number;
  height: number;
}): Promise<Buffer> {
  const sharp = await loadSharp();
  ensureCompositeFontconfig();
  const { ad, brandName, width, height } = opts;
  const hex1 = ad.gradientHex1 ?? "#1a1a2e";
  const hex2 = ad.gradientHex2 ?? "#16213e";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <style type="text/css">${compositeFontFaceCss()}</style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(hex1)}"/>
      <stop offset="100%" stop-color="${escapeXml(hex2)}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${width / 2}" y="${height * 0.5}" text-anchor="middle"
    font-family="${COMPOSITE_FONT_FAMILY}" font-size="22" fill="white" font-weight="700">KILL-ON-SIGHT — not an ad</text>
  <text x="${width / 2}" y="${height * 0.56}" text-anchor="middle"
    font-family="${COMPOSITE_FONT_FAMILY}" font-size="14" fill="rgba(255,255,255,0.7)" font-weight="400">${escapeXml(brandName)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
