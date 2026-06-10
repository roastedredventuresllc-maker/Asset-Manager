import type { CampaignAd } from "../ads/types.js";

export interface CompositeOptions {
  ad: CampaignAd;
  brandName: string;
  sourceImageBuffer?: Buffer;
  width: number;
  height: number;
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
    ${brandName.toUpperCase()}
  </text>
  <text x="${width / 2}" y="${height - 120}" text-anchor="middle"
    font-family="Georgia, serif" font-size="${width > 1000 ? 36 : 28}" fill="white" font-weight="400">
    ${ad.hook.length > 50 ? ad.hook.substring(0, 50) + "…" : ad.hook}
  </text>
  <rect x="${width / 2 - 80}" y="${height - 90}" width="160" height="44" rx="22" fill="white"/>
  <text x="${width / 2}" y="${height - 62}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="14" fill="#111111" font-weight="600">
    ${ad.cta}
  </text>
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
      <stop offset="0%" stop-color="${hex1}"/>
      <stop offset="100%" stop-color="${hex2}"/>
    </linearGradient>
    <radialGradient id="light" cx="30%" cy="20%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#light)"/>
  <text x="${width / 2}" y="${height * 0.38}" text-anchor="middle"
    font-family="Georgia, serif" font-size="${width > 1000 ? 48 : 36}" fill="white" font-weight="400">
    ${ad.hook.length > 40 ? ad.hook.substring(0, 40) + "…" : ad.hook}
  </text>
  <text x="${width / 2}" y="${height * 0.52}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.75)"
    font-weight="400">
    ${ad.body.length > 60 ? ad.body.substring(0, 60) + "…" : ad.body}
  </text>
  <text x="${width / 2}" y="${height * 0.25}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="13" fill="rgba(255,255,255,0.55)"
    letter-spacing="3" font-weight="600">
    ${brandName.toUpperCase()}
  </text>
  <rect x="${width / 2 - 90}" y="${height * 0.63}" width="180" height="48" rx="24" fill="white"/>
  <text x="${width / 2}" y="${height * 0.63 + 32}" text-anchor="middle"
    font-family="Inter, Arial, sans-serif" font-size="15" fill="#111111" font-weight="600">
    ${ad.cta}
  </text>
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
