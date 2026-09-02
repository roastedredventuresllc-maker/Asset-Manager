import { toFile } from "openai";
import { getXaiClient } from "./client";
import { resolveImagineModel, resolveXaiAuth } from "./auth";

export { resolveImagineModel } from "./auth";
export {
  DEFAULT_GATEWAY_IMAGINE_MODEL,
  DEFAULT_XAI_IMAGINE_MODEL,
} from "./auth";

export function isImagineConfigured(): boolean {
  return resolveXaiAuth() !== null;
}

async function bufferFromImageResponse(
  data: Array<{ b64_json?: string | null; url?: string | null }> | undefined,
): Promise<Buffer> {
  const first = data?.[0];
  const base64 = first?.b64_json ?? "";
  if (base64) return Buffer.from(base64, "base64");
  const url = first?.url?.trim();
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Grok Imagine URL fetch missed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("No image data in Grok Imagine response");
}

/** Grok Imagine legal aspects. `4:5` 422s (`unknown variant 4:5`). */
export const IMAGINE_ASPECTS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
] as const;
export type ImagineAspect = (typeof IMAGINE_ASPECTS)[number];

/**
 * Map campaign slot ratios onto Imagine. Hero / tight 4:5 → 3:4
 * (closest legal portrait). Never send 4:5.
 */
export function toImagineAspect(ratio: string): ImagineAspect {
  if (ratio === "9:16") return "9:16";
  if (ratio === "16:9") return "16:9";
  if (ratio === "1:1") return "1:1";
  if (ratio === "4:3") return "4:3";
  if (ratio === "2:3") return "2:3";
  if (ratio === "3:2") return "3:2";
  if (ratio === "3:4" || ratio === "4:5") return "3:4";
  return "3:4";
}

/**
 * One text-to-image Imagine call.
 * Gateway does not take OpenAI `size` for this model — pass aspect_ratio.
 */
export async function generateImagineImage(
  prompt: string,
  aspectRatio: string,
): Promise<Buffer> {
  const aspect = toImagineAspect(aspectRatio);
  const client = getXaiClient();
  const response = await client.images.generate({
    model: resolveImagineModel(),
    prompt,
    n: 1,
    response_format: "b64_json",
    ...({ aspect_ratio: aspect } as Record<string, unknown>),
  });
  return bufferFromImageResponse(response.data);
}

/**
 * One Imagine edit/reference call with the founder's product PNG.
 * Never pass a previous model's plate here — that would be a rescue/inpaint.
 */
export async function editImagineImage(
  prompt: string,
  productPng: Buffer,
  aspectRatio: string,
): Promise<Buffer> {
  const aspect = toImagineAspect(aspectRatio);
  const client = getXaiClient();
  const image = await toFile(productPng, "product.png", { type: "image/png" });
  const response = await client.images.edit({
    model: resolveImagineModel(),
    image,
    prompt,
    response_format: "b64_json",
    ...({ aspect_ratio: aspect } as Record<string, unknown>),
  });
  return bufferFromImageResponse(response.data);
}
