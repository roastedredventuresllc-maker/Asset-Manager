/**
 * Resolve Gemini credentials without throwing at import time.
 * Replit provisions AI_INTEGRATIONS_GEMINI_*; off-Replit we accept
 * GEMINI_API_KEY / GOOGLE_API_KEY and the public Gemini base URL.
 */
export function resolveGeminiAuth(): { apiKey: string; baseUrl: string } | null {
  const apiKey =
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  const baseUrl =
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com";
  return { apiKey, baseUrl };
}

export function isGeminiConfigured(): boolean {
  return resolveGeminiAuth() !== null;
}
