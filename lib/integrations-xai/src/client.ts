import OpenAI from "openai";
import { resolveXaiAuth, resolveXaiModel } from "./auth";

let cached: OpenAI | null = null;
let cachedKey: string | null = null;

export function getXaiClient(): OpenAI {
  const auth = resolveXaiAuth();
  if (!auth) {
    throw new Error(
      "Grok is not configured. On Vercel, enable AI Gateway (OIDC or AI_GATEWAY_API_KEY). Fallback: set XAI_API_KEY.",
    );
  }
  const cacheKey = `${auth.via}::${auth.baseURL}::${auth.apiKey}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = new OpenAI({ apiKey: auth.apiKey, baseURL: auth.baseURL });
    cachedKey = cacheKey;
  }
  return cached;
}

/** Lazy stand-in. Does not throw at import. */
export const xai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getXaiClient() as object, prop, receiver);
  },
});

export { isXaiConfigured, resolveXaiAuth, resolveXaiModel, resolveImagineModel } from "./auth";

/**
 * Chat completion constrained to a JSON object. The founder brief is the
 * intelligence input — this is a thin transport, not a template composer.
 */
export async function grokJsonChat(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const completion = await getXaiClient().chat.completions.create({
    model: resolveXaiModel(),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
  });
  const text = completion.choices[0]?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error("Empty JSON response from Grok");
  }
  return text;
}

/** Strip markdown fences then parse. Grok is asked for raw JSON; this is defensive. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(fenced);
}
