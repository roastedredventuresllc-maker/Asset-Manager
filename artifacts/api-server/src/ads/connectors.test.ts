import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONNECTOR_SPECS, V1_PLATFORM_IDS, adsMode } from "./connectors.js";
import { normalizeMetaAdAccountId, isMetaAdAccountId } from "./metaAccount.js";
import { normalizeGoogleCustomerId } from "./googleCustomer.js";
import { getAdPlatform } from "./index.js";
import { GoogleAdsAdPlatform } from "./google.js";

const here = dirname(fileURLToPath(import.meta.url));

test("v1 ship is Meta + TikTok + Google; LinkedIn stays out", () => {
  assert.deepEqual([...V1_PLATFORM_IDS].sort(), ["google", "meta", "tiktok"]);
  const linkedin = CONNECTOR_SPECS.find((s) => s.id === "linkedin");
  assert.equal(linkedin?.v1, false);
  const google = CONNECTOR_SPECS.find((s) => s.id === "google");
  assert.ok(google?.v1);
  assert.deepEqual(google?.requiredSecretKeys, [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ]);
  assert.deepEqual(google?.optionalSecretKeys, ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]);
  assert.ok((google?.setupSteps.length ?? 0) >= 4);
  assert.ok(google?.setupSteps.every((s) => typeof s.text === "string" && s.text.length > 0));
});

test("Google Ads client is a real AdPlatform, not a NOT_IMPLEMENTED stub", () => {
  const src = readFileSync(join(here, "google.ts"), "utf8");
  assert.equal(src.includes("NOT_IMPLEMENTED"), false);
  const client = new GoogleAdsAdPlatform({});
  assert.equal(typeof client.publishCampaign, "function");
  assert.equal(typeof client.pauseCampaign, "function");
  assert.equal(typeof client.resumeCampaign, "function");
  assert.equal(typeof client.getMetrics, "function");
});

test("product connector paths never assign ADS_MODE", () => {
  const files = [
    "credentials.ts",
    "connectors.ts",
    "verify.ts",
    "index.ts",
    "google.ts",
    join("..", "routes", "admin.ts"),
  ];
  for (const rel of files) {
    const src = readFileSync(join(here, rel), "utf8");
    assert.equal(
      /process\.env\.ADS_MODE\s*=/.test(src),
      false,
      `${rel} must not assign ADS_MODE`,
    );
  }
});

test("ADS_MODE defaults to mock and is not flipped by reading connectors", () => {
  const prev = process.env.ADS_MODE;
  delete process.env.ADS_MODE;
  assert.equal(adsMode(), "mock");
  process.env.ADS_MODE = prev;
});

test("META_BUSINESS_ID setup copy is Ad Account ID, digits only, no act_ prefix", () => {
  const meta = CONNECTOR_SPECS.find((s) => s.id === "meta");
  assert.ok(meta);
  const blob = [
    meta.secretKeyLabels?.META_BUSINESS_ID,
    ...meta.setupSteps.map((s) => s.text),
  ].join(" ");
  assert.match(blob, /Ad Account ID/);
  assert.match(blob, /not the Business Manager ID/);
  assert.match(blob, /no act_ prefix/);
});

test("META_BUSINESS_ID is treated as Ad Account ID (digits, optional act_ prefix)", () => {
  assert.equal(normalizeMetaAdAccountId("act_1234567890"), "1234567890");
  assert.equal(normalizeMetaAdAccountId("1234567890"), "1234567890");
  assert.ok(isMetaAdAccountId("act_1234567890"));
  assert.equal(isMetaAdAccountId("not-a-business-id"), false);
});

test("TIKTOK_IDENTITY_ID is required CUSTOMIZED_USER identity", () => {
  const tiktok = CONNECTOR_SPECS.find((s) => s.id === "tiktok");
  assert.ok(tiktok);
  assert.ok(tiktok.requiredSecretKeys.includes("TIKTOK_IDENTITY_ID"));
  const blob = tiktok.setupSteps.map((s) => s.text).join(" ");
  assert.match(blob, /TIKTOK_IDENTITY_ID/);
  assert.match(blob, /CUSTOMIZED_USER/);
});

test("Google customer IDs strip dashes from the Ads UI", () => {
  assert.equal(normalizeGoogleCustomerId("123-456-7890"), "1234567890");
});

test("mock publish works for Meta, TikTok, and Google without credentials", async () => {
  process.env.ADS_MODE = "mock";
  const input = {
    campaignId: "cmp_x",
    brandName: "Auric",
    tagline: "Clear",
    landingUrl: "https://example.com/p/x",
    dailyBudgetCents: 2500,
    audience: { ageMin: 25, ageMax: 54, interests: ["wellness"], geo: "US" },
    ads: [
      {
        hook: "Wake up clearer",
        body: "A nightly ritual.",
        cta: "Get yours",
        angle: "Hero",
        imagePrompt: "window light",
        gradientHex1: "#111",
        gradientHex2: "#222",
      },
    ],
  };
  for (const id of ["meta", "tiktok", "google"] as const) {
    const platform = await getAdPlatform(id);
    const result = await platform.publishCampaign(input);
    assert.match(result.externalCampaignId, new RegExp(`^mock_${id}_`));
  }
});
