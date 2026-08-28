import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(resolve(here, "../../../launchpad/src/pages/home.tsx"), "utf8");
const board = readFileSync(
  resolve(here, "../../../launchpad/src/components/campaign-board.tsx"),
  "utf8",
);

test("briefing is an art director table, not a variant gallery", () => {
  assert.doesNotMatch(home, /Variant\s*[ABC]/i);
  assert.doesNotMatch(home, /Ad\s*[123]\s*[—-]/);
  assert.doesNotMatch(home, /\blorem\b/i);
  assert.match(board, /Hero/);
  assert.match(board, /In use/);
  assert.match(board, /Close/);
  assert.doesNotMatch(board, /linear-gradient/);
  assert.match(home, /What's off|What’s off/);
  assert.doesNotMatch(home, /InSituAd/);
  assert.doesNotMatch(home, /CAMPAIGN_STEPS/);
});

test("failed photography is not shipped as a gradient ad", () => {
  assert.match(board, /Generation failed/);
  assert.match(home, /assetsFailed/);
  assert.match(home, /Generation failed/);
});

test("landing route does not ship a lettermark kit when stills miss", () => {
  const landingRoute = readFileSync(
    resolve(here, "../routes/landing.ts"),
    "utf8",
  );
  const landingPage = readFileSync(resolve(here, "landingPage.ts"), "utf8");
  assert.match(landingRoute, /pickLandingPhoto/);
  assert.match(landingPage, /failClosedHtml|photography did not come back/i);
  assert.doesNotMatch(landingPage, /hv-mark/);
  assert.doesNotMatch(landingPage, /★★★★★/);
  assert.doesNotMatch(landingPage, /function initials/);
});
