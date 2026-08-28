/**
 * Resolve xAI (Grok) credentials without throwing at import time.
 * Primary: XAI_API_KEY. Optional aliases for Replit-style names.
 */

export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
/** Current Grok chat model that supports JSON object responses. */
export const DEFAULT_XAI_MODEL = "grok-4.6";

export function resolveXaiAuth(): { apiKey: string; baseURL: string } | null {
  const apiKey =
    process.env.XAI_API_KEY || process.env.AI_INTEGRATIONS_XAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  const baseURL =
    process.env.XAI_BASE_URL ||
    process.env.AI_INTEGRATIONS_XAI_BASE_URL ||
    DEFAULT_XAI_BASE_URL;
  return { apiKey, baseURL };
}

export function isXaiConfigured(): boolean {
  return resolveXaiAuth() !== null;
}

export function resolveXaiModel(): string {
  const named = process.env.XAI_MODEL?.trim();
  return named && named.length > 0 ? named : DEFAULT_XAI_MODEL;
}
