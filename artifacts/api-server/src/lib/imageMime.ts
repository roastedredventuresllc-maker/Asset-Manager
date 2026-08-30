import { loadSharp } from "./loadSharp.js";

/**
 * JPEG/PNG product-photo trap.
 *
 * Uploads are stored as JPEG (`uploads.ts` + the founder canvas export).
 * Gemini/OpenAI edit calls declare `image/png`. If we pass JPEG bytes with a
 * PNG MIME, the model either fails or silently ignores the product photo.
 *
 * Fix: detect the real bytes, then sharp-re-encode to PNG so the declared
 * MIME matches. Do not lie about JPEG as PNG. Do not skip the re-encode.
 */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Re-encode any raster (including JPEG uploads) to PNG for edit calls. */
export async function reencodeToPng(input: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(input).png().toBuffer();
}

export const EDIT_MIME = "image/png" as const;
