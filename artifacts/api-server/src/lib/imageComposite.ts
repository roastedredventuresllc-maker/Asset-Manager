import type { CampaignAd } from "../ads/types.js";

export interface CompositeOptions {
  ad: CampaignAd;
  brandName: string;
  sourceImageBuffer?: Buffer;
  width: number;
  height: number;
}

/** Escape text before embedding in SVG markup — otherwise an unescaped `&`,
 * `<`, etc. (common in ad copy like "Health & Wellness") breaks SVG parsing
 * and the whole image render fails. */
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

/** A white pill button whose width adapts to the CTA text so it never
 * overflows or leaves the text clipped. */
function ctaPillSvg(cx: number, rectTopY: number, rawText: string, fontSize = 15): string {
  const display = truncate(rawText, 26);
  const charW = fontSize * 0.62;
  const padX = 30;
  const pillW = Math.max(150, Math.ceil(display.length * charW) + padX * 2);
  const pillH = Math.round(fontSize * 3);
  const x = cx - pillW / 2;
  const textY = rectTopY + Math.round(pillH / 2) + Math.round(fontSize * 0.35);
  return `<rect x="${x}" y="${rectTopY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="white"/>
  <text x="${cx}" y="${textY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" fill="#111111" font-weight="700">${escapeXml(display)}</text>`;
}

/**
 * Composite brand name + headline + CTA button on top of a source image buffer.
 * Returns a flat PNG buffer.
 */
export async function compositeAdImage(opts: CompositeOptions): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { ad, brandName, sourceImageBuffer, width, height } = opts;

  // Build SVG text overlay
  const svgOverlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  <text x="${width / 2}" y="${height - 160}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="13" fill="rgba(255,255,255,0.7)"
    letter-spacing="3" font-weight="600">
    ${escapeXml(brandName.toUpperCase())}
  </text>
  <text x="${width / 2}" y="${height - 120}" text-anchor="middle"
    font-family="Georgia, serif" font-size="${width > 1000 ? 36 : 28}" fill="white" font-weight="400">
    ${escapeXml(truncate(ad.hook, 50))}
  </text>
  ${ctaPillSvg(width / 2, height - 90, ad.cta, 15)}
</svg>`;

  if (sourceImageBuffer) {
    return sharp(sourceImageBuffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  // Fallback: gradient background with SVG text
  return makeSvgFallback(opts);
}

/**
 * SVG-only fallback for when fal.ai is unavailable.
 * Gradient background + radial light overlay + copy.
 */
export async function makeSvgFallback(opts: CompositeOptions): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { ad, brandName, width, height, sourceImageBuffer } = opts;

  const hex1 = ad.gradientHex1 ?? "#1a1a2e";
  const hex2 = ad.gradientHex2 ?? "#16213e";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(hex1)}"/>
      <stop offset="100%" stop-color="${escapeXml(hex2)}"/>
    </linearGradient>
    <radialGradient id="light" cx="30%" cy="20%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#light)"/>
  <text x="${width / 2}" y="${height * 0.25}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="13" fill="rgba(255,255,255,0.55)"
    letter-spacing="3" font-weight="600">
    ${escapeXml(brandName.toUpperCase())}
  </text>
  <text x="${width / 2}" y="${height * 0.38}" text-anchor="middle"
    font-family="Georgia, serif" font-size="${width > 1000 ? 48 : 36}" fill="white" font-weight="400">
    ${escapeXml(truncate(ad.hook, 40))}
  </text>
  <text x="${width / 2}" y="${height * 0.52}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.75)"
    font-weight="400">
    ${escapeXml(truncate(ad.body, 60))}
  </text>
  ${ctaPillSvg(width / 2, height * 0.63, ad.cta, 16)}
</svg>`;

  let base = sharp(Buffer.from(svg));

  if (sourceImageBuffer) {
    const productResized = await sharp(sourceImageBuffer)
      .resize(Math.round(width * 0.5), Math.round(height * 0.5), { fit: "contain" })
      .png()
      .toBuffer();

    base = base.composite([
      {
        input: productResized,
        top: Math.round(height * 0.05),
        left: Math.round(width * 0.25),
        blend: "over",
      },
    ]);
  }

  return base.png().toBuffer();
}
