import { loadSharp } from "./loadSharp.js";

export interface TypeInkStats {
  ink: number;
  components: number;
  hollowBoxes: number;
}

/**
 * White / near-white ink in the top type band. Tofu from a missing font is
 * a row of hollow rectangles (low fill ratio). Real Inter glyphs fill more
 * of their bbox and are not uniform boxes.
 */
export async function typeInkStats(
  png: Buffer,
  bandRatio = 0.32,
): Promise<TypeInkStats> {
  const sharp = await loadSharp();
  const meta = await sharp(png).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 8 || height < 8) {
    throw new Error("typeInkStats: plate too small");
  }
  const bandH = Math.max(8, Math.round(height * bandRatio));
  const { data, info } = await sharp(png)
    .extract({ left: 0, top: 0, width, height: bandH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const inkMask = new Uint8Array(w * h);
  let ink = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    if (r + g + b > 480) {
      inkMask[i] = 1;
      ink++;
    }
  }

  const seen = new Uint8Array(w * h);
  let components = 0;
  let hollowBoxes = 0;
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!inkMask[start] || seen[start]) continue;
      components++;
      let qh = 0;
      let qt = 0;
      qx[qt] = x;
      qy[qt] = y;
      qt++;
      seen[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      while (qh < qt) {
        const cx = qx[qh]!;
        const cy = qy[qh]!;
        qh++;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!inkMask[ni] || seen[ni]) continue;
          seen[ni] = 1;
          qx[qt] = nx;
          qy[qt] = ny;
          qt++;
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const area = bw * bh;
      const fill = area > 0 ? count / area : 0;
      const boxy = bw >= 8 && bh >= 8 && bw / bh > 0.45 && bw / bh < 1.8;
      if (boxy && fill < 0.28 && count >= 40) hollowBoxes++;
    }
  }

  return { ink, components, hollowBoxes };
}

export async function assertCompositedTypeIsReadable(
  png: Buffer,
  label: string,
): Promise<TypeInkStats> {
  const stats = await typeInkStats(png);
  if (stats.hollowBoxes > 0) {
    throw new Error(
      `Tofu boxes in composite (${label}): ${stats.hollowBoxes} hollow rects. Inter did not load.`,
    );
  }
  if (stats.ink < 400) {
    throw new Error(
      `Composite type is empty (${label}): ink=${stats.ink}. Inter did not paint glyphs.`,
    );
  }
  return stats;
}
