import { GoogleGenAI, Modality } from "@google/genai";
import { Buffer } from "node:buffer";
import { resolveGeminiAuth } from "../auth";

/**
 * Craft quality path. Nano Banana Pro. Do not invoke this model in this
 * run until the CEO approves spend — production code path is implemented;
 * tests inject stubs and never call the live model.
 */
export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

export type AspectRatio = "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "4:5";

interface InlineImage {
  data: Buffer;
  mimeType: string;
}

let cached: GoogleGenAI | null = null;
let cachedKey: string | null = null;

function getClient(): GoogleGenAI {
  const auth = resolveGeminiAuth();
  if (!auth) {
    throw new Error(
      "Gemini is not configured. Set GEMINI_API_KEY or AI_INTEGRATIONS_GEMINI_API_KEY.",
    );
  }
  const cacheKey = `${auth.baseUrl}::${auth.apiKey}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = new GoogleGenAI({
      apiKey: auth.apiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: auth.baseUrl,
      },
    });
    cachedKey = cacheKey;
  }
  return cached;
}

export function isGeminiImageConfigured(): boolean {
  return resolveGeminiAuth() !== null;
}

function extractImageBuffer(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
}): Buffer {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  const data = imagePart?.inlineData?.data;
  if (!data) {
    throw new Error("No image data in Gemini response");
  }
  return Buffer.from(data, "base64");
}

function imageConfig(aspectRatio: AspectRatio) {
  return {
    aspectRatio,
    // 1K is the default Pro Image size. Do not bump to 2K/4K here.
    imageSize: "1K",
  };
}

/**
 * Text-to-image via gemini-3-pro-image-preview (Nano Banana Pro).
 */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = "4:5",
): Promise<Buffer> {
  const response = await getClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio, imageSize: "1K" } as { aspectRatio: AspectRatio; imageSize: string },
    },
  });
  return extractImageBuffer(response);
}

/**
 * Image editing via gemini-3-pro-image-preview — scene built around the
 * founder's real product photo. `image.mimeType` must match the bytes
 * (pipeline re-encodes JPEG uploads to PNG and declares image/png).
 */
export async function editImage(
  prompt: string,
  image: InlineImage,
  aspectRatio: AspectRatio = "4:5",
): Promise<Buffer> {
  const response = await getClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: image.data.toString("base64"),
              mimeType: image.mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio, imageSize: "1K" } as { aspectRatio: AspectRatio; imageSize: string },
    },
  });
  return extractImageBuffer(response);
}

/** Lazy stand-in; does not throw at import. */
export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
