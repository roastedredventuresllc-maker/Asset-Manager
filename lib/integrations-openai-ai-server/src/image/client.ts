import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import { resolveOpenAIAuth } from "../auth";

let cached: OpenAI | null = null;
let cachedKey: string | null = null;

function getClient(): OpenAI {
  const auth = resolveOpenAIAuth();
  if (!auth) {
    throw new Error(
      "OpenAI is not configured. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.",
    );
  }
  const cacheKey = `${auth.baseURL}::${auth.apiKey}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = new OpenAI({ apiKey: auth.apiKey, baseURL: auth.baseURL });
    cachedKey = cacheKey;
  }
  return cached;
}

export function isOpenAIImageConfigured(): boolean {
  return resolveOpenAIAuth() !== null;
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" | "512x512" | "256x256" = "1024x1536",
): Promise<Buffer> {
  const response = await getClient().images.generate({
    model: "gpt-image-1",
    prompt,
    size: size === "512x512" || size === "256x256" ? "1024x1024" : size,
    quality: "high",
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data in OpenAI response");
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      }),
    ),
  );

  const response = await getClient().images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  if (!imageBase64) throw new Error("No image data in OpenAI edit response");
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
