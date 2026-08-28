import { GoogleGenAI } from "@google/genai";
import { resolveGeminiAuth } from "./auth";

let cached: GoogleGenAI | null = null;
let cachedKey: string | null = null;

export function getGeminiClient(): GoogleGenAI {
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

/** Lazy stand-in for the previous eager `ai` export. Does not throw at import. */
export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getGeminiClient() as object, prop, receiver);
  },
});

export { isGeminiConfigured, resolveGeminiAuth } from "./auth";
