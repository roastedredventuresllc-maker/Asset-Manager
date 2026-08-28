import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicAssetUrl,
  resolveFetchableUrl,
  publicOrigin,
  apiListenOrigin,
} from "./assetUrl.js";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const keys = [
    "PUBLIC_APP_URL",
    "REPLIT_DEV_DOMAIN",
    "REPLIT_DOMAINS",
    "PORT",
    "API_PORT",
    "VITE_DEV_PORT",
  ];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  for (const k of keys) {
    if (overrides[k] === undefined) delete process.env[k];
    else if (k in overrides) process.env[k] = overrides[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("local asset URLs are relative http paths, not https://localhost", () => {
  withEnv(
    {
      PUBLIC_APP_URL: undefined,
      REPLIT_DEV_DOMAIN: undefined,
      REPLIT_DOMAINS: undefined,
      PORT: "8080",
      API_PORT: undefined,
      VITE_DEV_PORT: undefined,
    },
    () => {
      assert.equal(publicAssetUrl("ad-images/x/0.png"), "/api/assets/ad-images/x/0.png");
      assert.equal(
        resolveFetchableUrl("/api/assets/ad-images/x/0.png"),
        "http://127.0.0.1:8080/api/assets/ad-images/x/0.png",
      );
      assert.ok(!publicAssetUrl("k").startsWith("https://"));
      assert.equal(apiListenOrigin(), "http://127.0.0.1:8080");
      assert.equal(publicOrigin(), "http://127.0.0.1:5173");
    },
  );
});

test("PUBLIC_APP_URL wins for Stripe/browser origin; fetches still hit the API", () => {
  withEnv(
    {
      PUBLIC_APP_URL: "http://localhost:5173",
      REPLIT_DEV_DOMAIN: undefined,
      REPLIT_DOMAINS: undefined,
      PORT: undefined,
      API_PORT: "8080",
      VITE_DEV_PORT: undefined,
    },
    () => {
      assert.equal(publicOrigin(), "http://localhost:5173");
      assert.equal(
        publicAssetUrl("ad-images/x/0.png"),
        "http://localhost:5173/api/assets/ad-images/x/0.png",
      );
      assert.equal(
        resolveFetchableUrl("/api/assets/ad-images/x/0.png"),
        "http://127.0.0.1:8080/api/assets/ad-images/x/0.png",
      );
    },
  );
});
