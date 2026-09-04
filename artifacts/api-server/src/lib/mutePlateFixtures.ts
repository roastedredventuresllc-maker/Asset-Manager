import { loadSharp } from "./loadSharp.js";

export type MutePlateKind =
  | "legal"
  | "empty"
  | "lettermark"
  | "type_band"
  | "off_safe"
  | "wet_sheen";

/**
 * Constructed mute plates for Craft locks and DEV family fixtures.
 * Not Imagine. Not Gemini. Inter is composited later.
 */
export async function renderMutePlate(opts: {
  width?: number;
  height?: number;
  seed?: number;
  kind?: MutePlateKind;
}): Promise<Buffer> {
  const width = opts.width ?? 240;
  const height = opts.height ?? 300;
  const seed = opts.seed ?? 0;
  const kind = opts.kind ?? "legal";
  const raw = Buffer.alloc(width * height * 3);

  const paintBg = (x: number, y: number, i: number) => {
    const v = (x ^ y ^ (seed * 13)) % 24;
    raw[i] = 16 + v;
    raw[i + 1] = 14 + (v >> 1);
    raw[i + 2] = 12;
  };

  const paintProduct = (i: number, x: number, y: number) => {
    const t = (x * 7 + y * 5 + seed * 11) % 14;
    raw[i] = 158 + t;
    raw[i + 1] = 142 + (t % 8);
    raw[i + 2] = 124 + (t % 6);
  };

  const inRect = (
    x: number,
    y: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
  ) => x >= x0 && x < x1 && y >= y0 && y < y1;

  let product:
    | { x0: number; x1: number; y0: number; y1: number }
    | undefined;
  let wet = false;

  if (kind === "legal") {
    product = {
      x0: Math.round(width * (0.3 + seed * 0.01)),
      x1: Math.round(width * (0.7 - seed * 0.01)),
      y0: Math.round(height * (0.5 + seed * 0.02)),
      y1: Math.round(height * 0.86),
    };
  } else if (kind === "lettermark") {
    product = {
      x0: Math.round(width * 0.445),
      x1: Math.round(width * 0.555),
      y0: Math.round(height * 0.6),
      y1: Math.round(height * 0.71),
    };
  } else if (kind === "type_band") {
    product = {
      x0: Math.round(width * 0.3),
      x1: Math.round(width * 0.7),
      y0: Math.round(height * 0.04),
      y1: Math.round(height * 0.28),
    };
  } else if (kind === "off_safe") {
    product = {
      x0: 0,
      x1: Math.round(width * 0.1),
      y0: Math.round(height * 0.45),
      y1: Math.round(height * 0.85),
    };
  } else if (kind === "wet_sheen") {
    wet = true;
    product = {
      x0: Math.round(width * 0.22),
      x1: Math.round(width * 0.78),
      y0: Math.round(height * 0.42),
      y1: Math.round(height * 0.88),
    };
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      paintBg(x, y, i);
      if (
        product &&
        inRect(x, y, product.x0, product.x1, product.y0, product.y1)
      ) {
        if (wet) {
          raw[i] = 255;
          raw[i + 1] = 255;
          raw[i + 2] = 255;
        } else {
          paintProduct(i, x, y);
        }
      }
    }
  }

  const sharp = await loadSharp();
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function renderLegalMutePlate(opts: {
  width?: number;
  height?: number;
  seed?: number;
} = {}): Promise<Buffer> {
  return renderMutePlate({ ...opts, kind: "legal" });
}
