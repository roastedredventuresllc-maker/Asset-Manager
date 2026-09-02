import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  isXaiConfigured,
  resolveXaiAuth,
  resolveXaiModel,
  resolveImagineModel,
  toImagineAspect,
  IMAGINE_ASPECTS,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_GATEWAY_MODEL,
  DEFAULT_GATEWAY_IMAGINE_MODEL,
  DEFAULT_XAI_BASE_URL,
  DEFAULT_XAI_MODEL,
} from "@workspace/integrations-xai";

const here = dirname(fileURLToPath(import.meta.url));

const KEYS = [
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "AI_GATEWAY_BASE_URL",
  "XAI_API_KEY",
  "AI_INTEGRATIONS_XAI_API_KEY",
  "XAI_BASE_URL",
  "AI_INTEGRATIONS_XAI_BASE_URL",
  "GROK_IMAGINE_MODEL",
] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = process.env[k];
  for (const k of KEYS) {
    if (!(k in overrides) || overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("AI Gateway key is preferred over XAI_API_KEY", () => {
  withEnv(
    {
      AI_GATEWAY_API_KEY: "gw-key",
      XAI_API_KEY: "xai-key",
    },
    () => {
      const auth = resolveXaiAuth();
      assert.equal(auth?.via, "gateway");
      assert.equal(auth?.apiKey, "gw-key");
      assert.equal(auth?.baseURL, DEFAULT_GATEWAY_BASE_URL);
      assert.equal(resolveXaiModel(), DEFAULT_GATEWAY_MODEL);
      assert.equal(isXaiConfigured(), true);
    },
  );
});

test("VERCEL_OIDC_TOKEN is enough for Gateway when no AI_GATEWAY_API_KEY", () => {
  withEnv(
    {
      AI_GATEWAY_API_KEY: undefined,
      VERCEL_OIDC_TOKEN: "oidc-jwt",
      XAI_API_KEY: undefined,
    },
    () => {
      const auth = resolveXaiAuth();
      assert.equal(auth?.via, "gateway");
      assert.equal(auth?.apiKey, "oidc-jwt");
      assert.equal(resolveXaiModel(), "xai/grok-4.6");
    },
  );
});

test("XAI_API_KEY is the fallback when Gateway is unset", () => {
  withEnv(
    {
      AI_GATEWAY_API_KEY: undefined,
      VERCEL_OIDC_TOKEN: undefined,
      XAI_API_KEY: "xai-key",
    },
    () => {
      const auth = resolveXaiAuth();
      assert.equal(auth?.via, "xai");
      assert.equal(auth?.baseURL, DEFAULT_XAI_BASE_URL);
      assert.equal(resolveXaiModel(), DEFAULT_XAI_MODEL);
    },
  );
});

test("bare XAI_MODEL is prefixed for Gateway", () => {
  withEnv(
    {
      AI_GATEWAY_API_KEY: "gw-key",
      XAI_MODEL: "grok-4.6",
    },
    () => {
      assert.equal(resolveXaiModel(), "xai/grok-4.6");
    },
  );
});

test("Grok chat has no generate abort wall (live copy already 201s)", () => {
  const src = readFileSync(join(here, "../../../../lib/integrations-xai/src/client.ts"), "utf8");
  assert.doesNotMatch(src, /GROK_CHAT_TIMEOUT_MS/);
  assert.doesNotMatch(src, /AbortController/);
});

test("toImagineAspect maps hero 4:5 onto a legal Imagine variant", () => {
  assert.equal(toImagineAspect("4:5"), "3:4");
  assert.ok((IMAGINE_ASPECTS as readonly string[]).includes("3:4"));
  assert.ok(!(IMAGINE_ASPECTS as readonly string[]).includes("4:5"));
});

test("Imagine model is Gateway GA id by default", () => {
  withEnv(
    {
      AI_GATEWAY_API_KEY: "gw-key",
      GROK_IMAGINE_MODEL: undefined,
    },
    () => {
      assert.equal(resolveImagineModel(), DEFAULT_GATEWAY_IMAGINE_MODEL);
      assert.equal(DEFAULT_GATEWAY_IMAGINE_MODEL, "xai/grok-imagine-image");
    },
  );
});
