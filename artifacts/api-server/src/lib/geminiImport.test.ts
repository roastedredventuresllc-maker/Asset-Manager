import { test } from "node:test";
import assert from "node:assert/strict";

test("Gemini image client does not throw at import without Replit envs", async () => {
  delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  const gemini = await import("@workspace/integrations-gemini-ai/image");
  assert.equal(gemini.GEMINI_IMAGE_MODEL, "gemini-3-pro-image-preview");
  assert.equal(gemini.isGeminiImageConfigured(), false);
});

test("OpenAI image client does not throw at import without Replit envs", async () => {
  delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const openai = await import("@workspace/integrations-openai-ai-server/image");
  assert.equal(openai.isOpenAIImageConfigured(), false);
});
