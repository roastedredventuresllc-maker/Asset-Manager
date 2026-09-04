import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCampaign, reviseCampaign, type CampaignData } from "./claude.js";
import { isXaiConfigured, DEFAULT_XAI_MODEL, DEFAULT_XAI_BASE_URL } from "@workspace/integrations-xai";
import { wordCount } from "./craft.js";

const sample: CampaignData = {
  brandName: "Northfold",
  tagline: "Apartment coffee without the cafe wait",
  category: "coffee",
  palette: ["#2C1810", "#C4A574", "#F4EDE4", "#1A1A1A"],
  audience: { ageMin: 25, ageMax: 44, interests: ["coffee", "design"], geo: "US" },
  channelSplit: { metaPct: 40, tiktokPct: 35, googlePct: 25, rationale: "DTC taste plus search." },
  recommendedBudgetPreset: "growth",
  ads: [
    {
      hook: "Coffee without the line",
      body: "A ceramic pour-over built for small kitchens and slower mornings.",
      cta: "Get yours",
      angle: "Hero",
      imagePrompt:
        "Hero pack-shot of a ceramic pour-over kettle on oak, window light, contact shadow, empty top third, no text no logos.",
      gradientHex1: "#2C1810",
      gradientHex2: "#C4A574",
    },
    {
      hook: "The morning, unhurried",
      body: "Same kettle, in use on a cramped apartment counter at first light.",
      cta: "Shop the kettle",
      angle: "Context",
      imagePrompt:
        "Context shot of the same ceramic kettle being poured in a real kitchen, same warm window light, empty top band, no text.",
      gradientHex1: "#2C1810",
      gradientHex2: "#C4A574",
    },
    {
      hook: "Feel the pour",
      body: "A closer look at the spout and glaze. Same light. Same kettle.",
      cta: "Order now",
      angle: "Craft",
      imagePrompt:
        "Tight crop of the same kettle spout and glaze, tactile, same color temperature, empty top third, no lettering.",
      gradientHex1: "#2C1810",
      gradientHex2: "#C4A574",
    },
  ],
  landing: {
    hero: "Better coffee at the counter",
    sub: "A pour-over for people who live in small kitchens.",
    features: ["Ceramic body", "Fits a two-cup ritual", "Cleans in the sink"],
    socialProof: "Made for apartment mornings.",
    cta: "Get the kettle",
    faqs: [
      { q: "What is it?", a: "A ceramic pour-over kettle for home coffee." },
      { q: "Who is it for?", a: "People brewing in small kitchens." },
      { q: "How do I start?", a: "Heat water, set the cone, pour slow." },
    ],
  },
};

test("xAI is not required at import — no Anthropic either", () => {
  delete process.env.XAI_API_KEY;
  delete process.env.AI_INTEGRATIONS_XAI_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(isXaiConfigured(), false);
  assert.equal(DEFAULT_XAI_MODEL, "grok-4.6");
  assert.equal(DEFAULT_XAI_BASE_URL, "https://api.x.ai/v1");
});

test("generate writes a campaign from the founder prompt via Grok (mocked)", async () => {
  const brief = "A ceramic pour-over kettle for apartment coffee. We roast in Brooklyn.";
  let sawBrief = false;
  const data = await generateCampaign(brief, {
    chat: async ({ user, system }) => {
      sawBrief = user.includes(brief);
      assert.match(system, /ONE campaign/);
      assert.match(system, /ONE SKU/);
      assert.match(system, /Do not drop a handle/);
      assert.match(system, /handle-less pitcher/);
      assert.match(system, /FULL-BLEED kitchen photograph/);
      assert.match(system, /gooseneck kettle/);
      assert.match(system, /bottom fifth clear/);
      assert.doesNotMatch(system, /bottom ~22%/);
      assert.match(system, /closer crop through the body/);
      assert.match(system, /Do not write a second hero pack-shot/);
      assert.doesNotMatch(system, /claude-sonnet/);
      return JSON.stringify(sample);
    },
  });
  assert.equal(sawBrief, true);
  assert.equal(data.brandName, "Northfold");
  assert.equal(data.ads.length, 3);
  for (const ad of data.ads) {
    const n = wordCount(ad.hook);
    assert.ok(n >= 2 && n <= 6, `hook "${ad.hook}" is ${n} words`);
    assert.doesNotMatch(ad.imagePrompt, /\b(reading|says|lettering|typography|logos?)\b/i);
  }
  assert.equal(
    data.channelSplit.metaPct + data.channelSplit.tiktokPct + data.channelSplit.googlePct,
    100,
  );
});

test("generate mentions the product photo when one was uploaded", async () => {
  let userMsg = "";
  await generateCampaign("Mushroom coffee for 2pm crashes", {
    hasProductPhoto: true,
    chat: async ({ user }) => {
      userMsg = user;
      return JSON.stringify(sample);
    },
  });
  assert.match(userMsg, /product photo/i);
});

test("revise applies the founder's request and reports visualChanged", async () => {
  const updated = {
    ...sample,
    brandName: "Fold & Pour",
    visualChanged: false,
  };
  const { campaign, visualChanged } = await reviseCampaign(sample, "Rename the brand Fold & Pour", {
    chat: async ({ user, system }) => {
      assert.match(user, /Fold & Pour/);
      assert.match(system, /ONE campaign/);
      assert.match(system, /Tight crop keeps the hero silhouette/);
      assert.match(system, /full-bleed 9:16/);
      assert.match(system, /gooseneck kettle/);
      assert.match(system, /blank bottom fifth/);
      return JSON.stringify(updated);
    },
  });
  assert.equal(campaign.brandName, "Fold & Pour");
  assert.equal(visualChanged, false);
});

test("revise visualChanged true when Grok says imagePrompts changed", async () => {
  const { visualChanged } = await reviseCampaign(sample, "Make the boards darker", {
    chat: async () => JSON.stringify({ ...sample, visualChanged: true }),
  });
  assert.equal(visualChanged, true);
});
