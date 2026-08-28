/**
 * Resolve Grok credentials without throwing at import time.
 *
 * Primary on Vercel: AI Gateway (AI_GATEWAY_API_KEY, then VERCEL_OIDC_TOKEN).
 * Fallback: XAI_API_KEY against api.x.ai. Never commit secrets.
 */

export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
/** Direct xAI chat model that supports JSON object responses. */
export const DEFAULT_XAI_MODEL = "grok-4.6";
/** AI Gateway slug for the same Grok model. */
export const DEFAULT_GATEWAY_MODEL = "xai/grok-4.6";
/** Current GA Grok Imagine stills id on AI Gateway. */
export const DEFAULT_GATEWAY_IMAGINE_MODEL = "xai/grok-imagine-image";
/** Direct xAI Imagine id when hitting api.x.ai. */
export const DEFAULT_XAI_IMAGINE_MODEL = "grok-imagine-image";

export type XaiAuth = {
  apiKey: string;
  baseURL: string;
  via: "gateway" | "xai";
};

function firstNonEmpty(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

export function resolveXaiAuth(): XaiAuth | null {
  const gatewayKey = firstNonEmpty(
    process.env.AI_GATEWAY_API_KEY,
    process.env.VERCEL_OIDC_TOKEN,
  );
  if (gatewayKey) {
    return {
      apiKey: gatewayKey,
      baseURL:
        firstNonEmpty(process.env.AI_GATEWAY_BASE_URL) ?? DEFAULT_GATEWAY_BASE_URL,
      via: "gateway",
    };
  }

  const apiKey = firstNonEmpty(
    process.env.XAI_API_KEY,
    process.env.AI_INTEGRATIONS_XAI_API_KEY,
  );
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL:
      firstNonEmpty(
        process.env.XAI_BASE_URL,
        process.env.AI_INTEGRATIONS_XAI_BASE_URL,
      ) ?? DEFAULT_XAI_BASE_URL,
    via: "xai",
  };
}

export function isXaiConfigured(): boolean {
  return resolveXaiAuth() !== null;
}

export function resolveXaiModel(): string {
  const named = process.env.XAI_MODEL?.trim();
  const auth = resolveXaiAuth();
  if (named && named.length > 0) {
    if (auth?.via === "gateway" && !named.includes("/")) {
      return `xai/${named}`;
    }
    return named;
  }
  return auth?.via === "gateway" ? DEFAULT_GATEWAY_MODEL : DEFAULT_XAI_MODEL;
}

/** Grok Imagine stills. Override with GROK_IMAGINE_MODEL if a preview id is required. */
export function resolveImagineModel(): string {
  const named = process.env.GROK_IMAGINE_MODEL?.trim();
  const auth = resolveXaiAuth();
  if (named && named.length > 0) {
    if (auth?.via === "gateway" && !named.includes("/")) {
      return `xai/${named}`;
    }
    return named;
  }
  return auth?.via === "gateway"
    ? DEFAULT_GATEWAY_IMAGINE_MODEL
    : DEFAULT_XAI_IMAGINE_MODEL;
}
