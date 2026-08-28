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

function bufferFromImageResponse(data: Array<{ b64_json?: string | null }> | undefined): Buffer {
  const base64 = data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data in Grok Imagine response");
  return Buffer.from(base64, "base64");
}

/**
 * One text-to-image Imagine call. aspectRatio is 4:5 or 9:16.
 * Gateway does not take OpenAI `size` for this model — pass aspect_ratio.
 */
export async function generateImagineImage(
  prompt: string,
  aspectRatio: "4:5" | "9:16",
): Promise<Buffer> {
  const client = getXaiClient();
  const response = await client.images.generate({
    model: resolveImagineModel(),
    prompt,
    n: 1,
    // Gateway / xAI Imagine: aspect_ratio, not size.
    ...({ aspect_ratio: aspectRatio } as Record<string, unknown>),
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
  aspectRatio: "4:5" | "9:16",
): Promise<Buffer> {
  const client = getXaiClient();
  const image = await toFile(productPng, "product.png", { type: "image/png" });
  const response = await client.images.edit({
    model: resolveImagineModel(),
    image,
    prompt,
    ...({ aspect_ratio: aspectRatio } as Record<string, unknown>),
  });
  return bufferFromImageResponse(response.data);
}
