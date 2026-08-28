/**
 * Resolve OpenAI credentials without throwing at import time.
 * Replit provisions AI_INTEGRATIONS_OPENAI_*; off-Replit we accept OPENAI_API_KEY.
 */
export function resolveOpenAIAuth(): { apiKey: string; baseURL: string } | null {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  return { apiKey, baseURL };
}

export function isOpenAIConfigured(): boolean {
  return resolveOpenAIAuth() !== null;
}
