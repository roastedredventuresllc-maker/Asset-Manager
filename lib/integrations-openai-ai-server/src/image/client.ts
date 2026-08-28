import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import { resolveOpenAIAuth } from "../auth";

export const GPT_IMAGE_MODEL = "gpt-image-2";
export const GPT_IMAGE_GATEWAY_MODEL = "openai/gpt-image-2";
const GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";

type ImageAuth = { apiKey: string; baseURL: string; via: "gateway" | "openai" };

function firstNonEmpty(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

/** Gateway first so Vercel OIDC can run gpt-image-2 without a pasted OpenAI key. */
function resolveImageAuth(): ImageAuth | null {
  const gatewayKey = firstNonEmpty(
    process.env.AI_GATEWAY_API_KEY,
    process.env.VERCEL_OIDC_TOKEN,
  );
  if (gatewayKey) {
    return {
      apiKey: gatewayKey,
      baseURL: firstNonEmpty(process.env.AI_GATEWAY_BASE_URL) ?? GATEWAY_BASE,
      via: "gateway",
    };
  }
  const fallback = resolveOpenAIAuth();
  if (!fallback) return null;
  return { ...fallback, via: "openai" };
}

function modelFor(auth: ImageAuth): string {
  const named = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (named) {
    if (auth.via === "gateway" && !named.includes("/")) return `openai/${named}`;
    return named;
  }
  return auth.via === "gateway" ? GPT_IMAGE_GATEWAY_MODEL : GPT_IMAGE_MODEL;
}

let cached: OpenAI | null = null;
let cachedKey: string | null = null;

function getClient(): OpenAI {
  const auth = resolveImageAuth();
  if (!auth) {
    throw new Error(
      "gpt-image-2 is not configured. On Vercel use AI Gateway (OIDC or AI_GATEWAY_API_KEY). Fallback: OPENAI_API_KEY.",
    );
  }
  const cacheKey = `${auth.via}::${auth.baseURL}::${auth.apiKey}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = new OpenAI({ apiKey: auth.apiKey, baseURL: auth.baseURL });
    cachedKey = cacheKey;
  }
  return cached;
}

export function isOpenAIImageConfigured(): boolean {
  return resolveImageAuth() !== null;
}

export function resolveGptImageModel(): string {
  const auth = resolveImageAuth();
  if (!auth) return GPT_IMAGE_MODEL;
  return modelFor(auth);
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
  const auth = resolveImageAuth();
  if (!auth) throw new Error("gpt-image-2 is not configured");
  const response = await getClient().images.generate({
    model: modelFor(auth),
    prompt,
    size: size === "512x512" || size === "256x256" ? "1024x1024" : size,
    quality: "high",
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data in gpt-image-2 response");
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  const auth = resolveImageAuth();
  if (!auth) throw new Error("gpt-image-2 is not configured");
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      }),
    ),
  );

  const response = await getClient().images.edit({
    model: modelFor(auth),
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  if (!imageBase64) throw new Error("No image data in gpt-image-2 edit response");
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
