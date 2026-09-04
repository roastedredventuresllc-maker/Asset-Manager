import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildLandingHtml, pickLandingPhoto } from "./landingPage.js";

const sample = {
  brandName: "Noxrun",
  tagline: "Matte black hydration for after-dark miles",
  palette: ["#111111", "#888888"],
  landing: {
    hero: "Fuel every mile after dark",
    sub: "A matte black 16-ounce water bottle for people who run after sunset.",
    features: ["Matte grip", "16 ounces"],
    socialProof: "Built around the night-running habit, not borrowed from daytime gym bottles.",
    cta: "Get the bottle",
    faqs: [{ q: "What is it?", a: "A bottle." }],
  },
};

test("landing without stills is fail-closed, not a lettermark kit", () => {
  const html = buildLandingHtml({
    slug: "noxrun-x",
    campaign: sample,
    productImg: "",
    canonical: "https://example.com/p/noxrun-x",
  });
  assert.match(html, /Photography did not come back|photography did not come back/i);
  assert.doesNotMatch(html, /★★★★★/);
  assert.doesNotMatch(html, /hv-mark/);
  assert.doesNotMatch(html, /hero-visual--type/);
  assert.doesNotMatch(html, /F9F7F4/);
  assert.doesNotMatch(html, /Get the bottle/);
  assert.match(html, /#161310/);
});

test("landing with a still is a dark-room product page: sharp plate, no cream kit", () => {
  const html = buildLandingHtml({
    slug: "noxrun-x",
    campaign: sample,
    productImg: "https://blob.example/ad-images/cmp/0.png",
    canonical: "https://example.com/p/noxrun-x",
  });
  assert.match(html, /<img src="https:\/\/blob\.example\/ad-images\/cmp\/0\.png"/);
  assert.match(html, /class="hero-still/);
  assert.match(html, /Get the bottle/);
  assert.match(html, /#161310/);
  assert.doesNotMatch(html, /★★★★★/);
  assert.doesNotMatch(html, /hv-mark/);
  assert.doesNotMatch(html, /F9F7F4/);
  assert.doesNotMatch(html, /249,\s*247,\s*244/);
  assert.doesNotMatch(html, /--canvas/);
  assert.doesNotMatch(html, /See how it works/);
  assert.doesNotMatch(html, /class="halo"/);
  assert.doesNotMatch(html, /radial-gradient/);
  assert.doesNotMatch(html, /filter:\s*blur/);
  assert.doesNotMatch(html, /blur-placeholder/);
  assert.doesNotMatch(html, /hero-visual/);
  assert.doesNotMatch(html, /family=Inter|'Inter'|\"Inter\"/);
  assert.doesNotMatch(html, /class="closing"/);
});

test("pickLandingPhoto prefers a done still over the founder upload", () => {
  assert.equal(
    pickLandingPhoto("https://blob.example/founder.jpg", [
      { idx: 2, status: "failed", imageUrl: null },
      { idx: 0, status: "done", imageUrl: "https://blob.example/hero.png" },
    ]),
    "https://blob.example/hero.png",
  );
  assert.equal(
    pickLandingPhoto("https://blob.example/founder.jpg", [
      { idx: 0, status: "failed", imageUrl: null },
    ]),
    "https://blob.example/founder.jpg",
  );
  assert.equal(pickLandingPhoto(null, [{ idx: 0, status: "failed" }]), "");
});

test("Imagine and gpt-image-2 ask for b64_json and accept a URL fallback", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const xai = readFileSync(
    join(here, "../../../../lib/integrations-xai/src/image.ts"),
    "utf8",
  );
  const openai = readFileSync(
    join(here, "../../../../lib/integrations-openai-ai-server/src/image/client.ts"),
    "utf8",
  );
  assert.match(xai, /response_format: "b64_json"/);
  assert.match(xai, /first\?\.url/);
  assert.match(openai, /response_format: "b64_json"/);
  assert.match(openai, /first\?\.url/);
});
