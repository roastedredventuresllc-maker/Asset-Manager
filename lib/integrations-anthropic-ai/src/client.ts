import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicAuth } from "./auth";

let cached: Anthropic | null = null;
let cachedKey: string | null = null;

export function getAnthropicClient(): Anthropic {
  const auth = resolveAnthropicAuth();
  if (!auth) {
    throw new Error(
      "Anthropic is not configured. Set ANTHROPIC_API_KEY or AI_INTEGRATIONS_ANTHROPIC_API_KEY.",
    );
  }
  const cacheKey = `${auth.baseURL}::${auth.apiKey}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = new Anthropic({ apiKey: auth.apiKey, baseURL: auth.baseURL });
    cachedKey = cacheKey;
  }
  return cached;
}

/** Lazy stand-in for the previous eager export. Does not throw at import. */
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getAnthropicClient() as object, prop, receiver);
  },
});

export { isAnthropicConfigured, resolveAnthropicAuth } from "./auth";
