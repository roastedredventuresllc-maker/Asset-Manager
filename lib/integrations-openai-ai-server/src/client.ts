import OpenAI from "openai";
import { resolveOpenAIAuth } from "./auth";

let cached: OpenAI | null = null;
let cachedKey: string | null = null;

export function getOpenAIClient(): OpenAI {
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

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAIClient() as object, prop, receiver);
  },
});

export { isOpenAIConfigured, resolveOpenAIAuth } from "./auth";
