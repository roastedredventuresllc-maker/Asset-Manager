import { loadSharp } from "./loadSharp.js";

export type MutePlateKind =
  | "legal"
  | "empty"
  | "lettermark"
  | "type_band"
  | "off_safe"
  | "wet_sheen"
  | "flat_well"
  | "pale_linen"
  | "split_panel"
  | "letterbox"
  | "lifted";

type Ground = "dark" | "linen";

/**
 * Constructed mute plates for Craft locks.
 * Legal plates carry a bottle silhouette with interior material — never a
 * flat beige rectangle. Not Imagine. Not Gemini. Inter is composited later.
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

  const ground: Ground = kind === "pale_linen" ? "linen" : "dark";

  const paintGround = (x: number, y: number, i: number) => {
    if (ground === "linen") {
      const n = ((x * 3 + y * 5 + seed) % 11) - 5;
      raw[i] = 214 + n;
      raw[i + 1] = 202 + n;
      raw[i + 2] = 184 + (n >> 1);
      return;
    }
    const n = (x * 3 + y + seed) % 7;
    raw[i] = 22 + n;
    raw[i + 1] = 20 + (n >> 1);
    raw[i + 2] = 18;
  };

  const paintBottle = (
    x: number,
    y: number,
    i: number,
    cx: number,
    bodyTop: number,
    bodyBot: number,
    bodyRx: number,
  ) => {
    const ny = (y - bodyTop) / Math.max(bodyBot - bodyTop, 1);
    const nx = (x - cx) / Math.max(bodyRx, 1);
    const form = ny * 24;
    const lobe = Math.sin(ny * Math.PI * 3 + seed) * 18;
    const highlight = nx < -0.15 && nx > -0.55 ? 16 : 0;
    const t = (Math.floor(y / 6) * 9 + Math.floor(x / 5) + seed * 11) % 12;
    raw[i] = Math.max(38, Math.min(145, 78 + t + lobe + highlight - form));
    raw[i + 1] = Math.max(34, Math.min(130, 66 + (t % 8) + lobe * 0.4 - form * 0.7));
    raw[i + 2] = Math.max(30, Math.min(115, 54 + (t % 6) - form * 0.5));
  };

  const inBottle = (
    x: number,
    y: number,
    cx: number,
    bodyTop: number,
    bodyBot: number,
    bodyRx: number,
  ): boolean => {
    const midY = (bodyTop + bodyBot) / 2;
    const bodyRy = (bodyBot - bodyTop) / 2;
    const nx = (x - cx) / Math.max(bodyRx, 1);
    const ny = (y - midY) / Math.max(bodyRy, 1);
    if (nx * nx + ny * ny <= 1) return true;
    const neckTop = bodyTop - height * 0.07;
    const neckW = width * 0.05;
    if (y >= neckTop && y < bodyTop && Math.abs(x - cx) < neckW) return true;
    const capTop = neckTop - height * 0.025;
    if (y >= capTop && y < neckTop && Math.abs(x - cx) < neckW * 1.2) return true;
    return false;
  };

  const inCircle = (x: number, y: number, cx: number, cy: number, r: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  let bottle:
    | { cx: number; bodyTop: number; bodyBot: number; bodyRx: number }
    | undefined;
  let mark: { cx: number; cy: number; r: number } | undefined;
  let flatRect:
    | { x0: number; x1: number; y0: number; y1: number }
    | undefined;
  let wet = false;

  if (kind === "legal" || kind === "pale_linen") {
    bottle = {
      cx: width * (0.5 + seed * 0.01),
      bodyTop: height * (0.52 + seed * 0.01),
      bodyBot: height * 0.84,
      bodyRx: width * 0.17,
    };
  } else if (kind === "lettermark") {
    mark = {
      cx: width * 0.5,
      cy: height * 0.66,
      r: width * 0.07,
    };
  } else if (kind === "type_band") {
    bottle = {
      cx: width * 0.5,
      bodyTop: height * 0.06,
      bodyBot: height * 0.28,
      bodyRx: width * 0.16,
    };
  } else if (kind === "off_safe") {
    bottle = {
      cx: width * 0.06,
      bodyTop: height * 0.5,
      bodyBot: height * 0.84,
      bodyRx: width * 0.08,
    };
  } else if (kind === "wet_sheen") {
    wet = true;
    bottle = {
      cx: width * 0.5,
      bodyTop: height * 0.46,
      bodyBot: height * 0.86,
      bodyRx: width * 0.28,
    };
  } else if (kind === "flat_well") {
    flatRect = {
      x0: Math.round(width * 0.28),
      x1: Math.round(width * 0.72),
      y0: Math.round(height * 0.48),
      y1: Math.round(height * 0.86),
    };
  } else if (kind === "split_panel") {
    bottle = {
      cx: width * 0.32,
      bodyTop: height * 0.5,
      bodyBot: height * 0.84,
      bodyRx: width * 0.14,
    };
  } else if (kind === "letterbox") {
    bottle = {
      cx: width * 0.5,
      bodyTop: height * 0.42,
      bodyBot: height * 0.72,
      bodyRx: width * 0.18,
    };
  } else if (kind === "lifted") {
    bottle = {
      cx: width * 0.5,
      bodyTop: height * 0.18,
      bodyBot: height * 0.7,
      bodyRx: width * 0.18,
    };
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (kind === "split_panel" && x >= Math.round(width * 0.58)) {
        raw[i] = 236;
        raw[i + 1] = 228;
        raw[i + 2] = 214;
        continue;
      }
      if (
        kind === "letterbox" &&
        (y < Math.round(height * 0.3) || y >= Math.round(height * 0.8))
      ) {
        raw[i] = 236;
        raw[i + 1] = 228;
        raw[i + 2] = 214;
        continue;
      }
      paintGround(x, y, i);
      if (
        bottle &&
        inBottle(x, y, bottle.cx, bottle.bodyTop, bottle.bodyBot, bottle.bodyRx)
      ) {
        if (wet) {
          raw[i] = 255;
          raw[i + 1] = 255;
          raw[i + 2] = 255;
        } else {
          paintBottle(
            x,
            y,
            i,
            bottle.cx,
            bottle.bodyTop,
            bottle.bodyBot,
            bottle.bodyRx,
          );
        }
      } else if (mark && inCircle(x, y, mark.cx, mark.cy, mark.r)) {
        const ring = !inCircle(x, y, mark.cx, mark.cy, mark.r * 0.45);
        if (ring) {
          raw[i] = 170;
          raw[i + 1] = 160;
          raw[i + 2] = 148;
        }
      } else if (
        flatRect &&
        x >= flatRect.x0 &&
        x < flatRect.x1 &&
        y >= flatRect.y0 &&
        y < flatRect.y1
      ) {
        raw[i] = 196;
        raw[i + 1] = 178;
        raw[i + 2] = 150;
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
