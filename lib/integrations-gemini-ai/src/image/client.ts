import { GoogleGenAI, Modality } from "@google/genai";
import { Buffer } from "node:buffer";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
  );
}

export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// "nano banana" — Google's native image generation/editing model.
const IMAGE_MODEL = "gemini-2.5-flash-image";

export type AspectRatio = "1:1" | "9:16" | "16:9" | "3:4" | "4:3";

interface InlineImage {
  data: Buffer;
  mimeType: string;
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

/**
 * Text-to-image generation with Nano Banana (gemini-2.5-flash-image).
 * Returns a raw image Buffer.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = "1:1",
): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio },
    },
  });
  return extractImageBuffer(response);
}

/**
 * Image editing with Nano Banana — builds a new scene around an input image
 * (e.g. the founder's real product photo). Returns a raw image Buffer.
 */
export async function editImage(
  prompt: string,
  image: InlineImage,
  aspectRatio: AspectRatio = "1:1",
): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
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
      imageConfig: { aspectRatio },
    },
  });
  return extractImageBuffer(response);
}
