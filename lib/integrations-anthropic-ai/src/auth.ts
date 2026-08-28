/**
 * Resolve Anthropic credentials without throwing at import time.
 * Replit provisions AI_INTEGRATIONS_ANTHROPIC_*; off-Replit we accept ANTHROPIC_API_KEY.
 */
export function resolveAnthropicAuth(): { apiKey: string; baseURL: string } | null {
  const apiKey =
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  const baseURL =
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  return { apiKey, baseURL };
}

export function isAnthropicConfigured(): boolean {
  return resolveAnthropicAuth() !== null;
}
